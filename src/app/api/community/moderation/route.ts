import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { archiveId, authenticatedModerator, reportTargetSchema, targetReference } from '@/lib/community-moderation';
import { prepareRequestBudget } from '@/lib/request-budget';
import { requireDocumentId } from '@/lib/forum-deletion';

export const runtime = 'nodejs';
const Input = z.object({ reportId: z.string(), action: z.enum(['hide', 'restore', 'dismiss']), reason: z.string().trim().min(5).max(2000), requestId: z.string().uuid() }).strict();
export async function GET(request: NextRequest) {
  try {
    await authenticatedModerator(request);
    const db = getAdminDb();
    const page = await db.collection('_communityReports').where('status', 'in', ['open', 'hidden']).orderBy('createdAt', 'asc').limit(50).get();
    const reports = await Promise.all(page.docs.map(async doc => {
      const data = doc.data();
      const target = reportTargetSchema.parse(data.target);
      const ref = targetReference(db, target);
      const [content, archived] = await Promise.all([ref.get(), db.collection('_moderationArchives').doc(archiveId(ref.path)).get()]);
      const original = content.data() ?? archived.get('snapshot');
      const preview = [original?.title, original?.content].filter(value => typeof value === 'string').join('\n').slice(0, 4000);
      return { id: doc.id, target, reason: data.reason, status: data.status, preview, hidden: archived.exists, exists: content.exists };
    }));
    return NextResponse.json({ reports, limit: 50 }, { headers: { 'Cache-Control': 'no-store' } });
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
      if (input.action === 'dismiss' && report.get('status') !== 'open') throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Only open reports can be dismissed; restore hidden content first.');
      if (input.action === 'hide' && !current.exists && !archive.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Content no longer exists.');
      if (input.action === 'restore' && (!archive.exists || current.exists || tombstone?.exists || (parentRef && !parent?.exists))) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Content cannot be restored over a deletion or an existing item.');
      if (target.kind === 'comment' && input.action !== 'dismiss' && (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER)) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'The parent counter requires repair.');
      const commitBudget = await prepareRequestBudget(transaction, uid, 'community-mutate', Buffer.byteLength(input.reason));
      commitBudget();
      if (input.action === 'hide' && current.exists && !archive.exists) {
        transaction.create(archiveRef, { target, snapshot: current.data(), hiddenBy: uid, reason: input.reason, hiddenAt: FieldValue.serverTimestamp() });
        transaction.delete(ref);
        if (parentRef) transaction.update(parentRef, { commentsCount: Math.max(0, count - 1) });
      } else if (input.action === 'restore') {
        transaction.create(ref, archive.get('snapshot'));
        transaction.delete(archiveRef);
        if (parentRef) transaction.update(parentRef, { commentsCount: count + 1 });
      }
      transaction.update(reportRef, { status: input.action === 'hide' ? 'hidden' : input.action === 'restore' ? 'restored' : 'dismissed', decidedBy: uid, decisionReason: input.reason, decidedAt: FieldValue.serverTimestamp() });
      transaction.create(db.collection('_moderationActions').doc(), { reportId: input.reportId, target, action: input.action, reason: input.reason, actorId: uid, createdAt: FieldValue.serverTimestamp() });
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (error) { return apiFailure(error); }
}
