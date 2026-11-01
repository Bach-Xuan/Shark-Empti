import { NextRequest, NextResponse } from 'next/server';
import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { archiveId, authenticatedModerator, reportTargetSchema, targetReference } from '@/lib/community-moderation';
import { prepareRequestBudget } from '@/lib/request-budget';
import { requireDocumentId } from '@/lib/forum-deletion';
import { forumPublicReference, prepareForumPublication } from '@/lib/forum-publication';
import { projectForumMetadata } from '@/lib/community-projections';

export const runtime = 'nodejs';
const Input = z.object({ reportId: z.string(), action: z.enum(['hide', 'restore', 'dismiss']), reason: z.string().trim().min(5).max(2000), requestId: z.string().uuid() }).strict();
const QueueInput = z.object({ status: z.enum(['open', 'hidden']).default('open'), after: z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/).optional() }).strict();
const Cursor = z.object({ status: z.enum(['open', 'hidden']), seconds: z.number().int().min(-62135596800).max(253402300799), nanoseconds: z.number().int().min(0).max(999999999), id: z.string().min(1).max(128) }).strict();
export async function GET(request: NextRequest) {
  try {
    await authenticatedModerator(request);
    const input = QueueInput.parse(Object.fromEntries(new URL(request.url).searchParams));
    const db = getAdminDb();
    let source = db.collection('_communityReports').where('status', '==', input.status)
      .orderBy('createdAt', 'asc').orderBy(FieldPath.documentId(), 'asc');
    if (input.after) {
      const cursor = Cursor.parse(JSON.parse(Buffer.from(input.after, 'base64url').toString('utf8')));
      requireDocumentId(cursor.id);
      if (cursor.status !== input.status) throw new ApiError('APP-INVALID-INPUT', 400, 'The cursor belongs to another queue.');
      source = source.startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id);
    }
    const page = await source.limit(51).get();
    const visible = page.docs.slice(0, 50);
    const reports = await Promise.all(visible.map(async doc => {
      const data = doc.data();
      const target = reportTargetSchema.parse(data.target);
      const ref = targetReference(db, target);
      const [content, archived] = await Promise.all([ref.get(), db.collection('_moderationArchives').doc(archiveId(ref.path)).get()]);
      const original = content.data() ?? archived.get('snapshot');
      const preview = [original?.title, original?.content].filter(value => typeof value === 'string').join('\n').slice(0, 4000);
      return { id: doc.id, target, reason: data.reason, status: data.status, preview, hidden: archived.exists, exists: content.exists };
    }));
    const last = visible.at(-1);
    const timestamp = last?.get('createdAt') as Timestamp | undefined;
    const nextCursor = page.size > 50 && last && timestamp ? Buffer.from(JSON.stringify({
      status: input.status, seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds, id: last.id,
    })).toString('base64url') : null;
    return NextResponse.json({ reports, limit: 50, nextCursor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedModerator(request);
    const { requestId, ...input } = Input.parse(await readLimitedJson(request, 16_384));
    requireDocumentId(input.reportId);
    const db = getAdminDb();
    const result = await idempotentTransaction('community-moderation', uid, requestId, input, async transaction => {
      const reportRef = db.collection('_communityReports').doc(input.reportId);
      const report = await transaction.get(reportRef);
      if (!report.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Report not found.');
      const target = reportTargetSchema.parse(report.get('target'));
      const ref = targetReference(db, target);
      const archiveRef = db.collection('_moderationArchives').doc(archiveId(ref.path));
      const [current, archive] = await Promise.all([transaction.get(ref), transaction.get(archiveRef)]);
      const parentId = target.kind === 'comment' ? target.parentId : target.kind === 'post' ? target.id : null;
      const tombstone = parentId ? await transaction.get(db.collection('_forumDeletions').doc(parentId)) : null;
      const parentRef = target.kind === 'comment' ? db.collection('posts').doc(target.parentId) : null;
      const parent = parentRef ? await transaction.get(parentRef) : null;
      const count = parent?.get('commentsCount');
      const publication = await prepareForumPublication(transaction, db, ref.path);
      const parentPublication = parentRef ? await prepareForumPublication(transaction, db, parentRef.path) : null;
      if (input.action === 'dismiss' && report.get('status') !== 'open') throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Only open reports can be dismissed; restore hidden content first.');
      if (input.action === 'hide' && !current.exists && !archive.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Content no longer exists.');
      if (input.action === 'restore' && (!archive.exists || current.exists || tombstone?.exists || (parentRef && !parent?.exists))) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Content cannot be restored over a deletion or an existing item.');
      if (input.action === 'restore' && target.kind !== 'exam' && archive.get('privacyReady') !== true) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This archive requires a privacy migration before restoration.');
      if (target.kind === 'comment' && input.action !== 'dismiss' && (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER)) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'The parent counter requires repair.');
      const commitBudget = await prepareRequestBudget(transaction, uid, 'community-mutate', Buffer.byteLength(input.reason));
      commitBudget();
      if (input.action === 'hide' && current.exists && !archive.exists) {
        transaction.create(archiveRef, { target, snapshot: current.data(), hiddenBy: uid, reason: input.reason, hiddenAt: FieldValue.serverTimestamp(), ...(target.kind !== 'exam' ? { privacyReady: publication.published } : {}) });
        transaction.delete(ref);
        publication.remove();
        if (parentRef) transaction.update(parentRef, { commentsCount: Math.max(0, count - 1) });
        if (parent) parentPublication?.write({ ...parent.data(), commentsCount: Math.max(0, count - 1) });
      } else if (input.action === 'restore') {
        transaction.create(ref, archive.get('snapshot'));
        if (target.kind !== 'exam') {
          const projection = projectForumMetadata(archive.get('snapshot'), target.kind);
          if (!projection) throw new ApiError('APP-DATA-INVALID', 409, 'The archive metadata requires repair.');
          transaction.create(forumPublicReference(db, ref.path)!, projection);
        }
        transaction.delete(archiveRef);
        if (parentRef) transaction.update(parentRef, { commentsCount: count + 1 });
        if (parent) parentPublication?.write({ ...parent.data(), commentsCount: count + 1 });
      }
      transaction.update(reportRef, { status: input.action === 'hide' ? 'hidden' : input.action === 'restore' ? 'restored' : 'dismissed', decidedBy: uid, decisionReason: input.reason, decidedAt: FieldValue.serverTimestamp() });
      transaction.create(db.collection('_moderationActions').doc(), { reportId: input.reportId, target, action: input.action, reason: input.reason, actorId: uid, createdAt: FieldValue.serverTimestamp() });
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (error) { return apiFailure(error); }
}
