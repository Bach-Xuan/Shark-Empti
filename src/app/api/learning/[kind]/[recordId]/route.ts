import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, assertWritable, authenticatedUser } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { enforceRequestBudget, prepareRequestBudget } from '@/lib/request-budget';
import { canonicalJson } from '@/lib/canonical-json';
import { learningKinds, learningWriteSchemas, historyFeedbackSchema } from '@/lib/learning-records';
import { readHistoryItem } from '@/lib/history-schema';
import { LEARNING_LIMITS } from '@/lib/data-limits';
import { requireDocumentId } from '@/lib/forum-deletion';

export const runtime = 'nodejs';
type Context = { params: Promise<{ kind: string; recordId: string }> };
const headers = { 'Cache-Control': 'no-store' };
function checkSize(value: unknown) {
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (bytes > LEARNING_LIMITS.recordBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'The learning record exceeds the supported size.');
  return bytes;
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'learning-traffic');
    const { kind: rawKind, recordId } = await params;
    const kind = z.enum(learningKinds).parse(rawKind);
    z.string().uuid().parse(recordId);
    const parsed = learningWriteSchemas[kind].parse(await readLimitedJson(request, LEARNING_LIMITS.bodyBytes));
    const data = JSON.parse(JSON.stringify(parsed)); // Omit optional undefined properties.
    if (kind === 'history' && data.date > Date.now() + 300_000) throw new ApiError('APP-INVALID-INPUT', 400, 'Completion time is invalid.');
    const bytes = checkSize(data);
    const fingerprint = createHash('sha256').update(canonicalJson([uid, kind, recordId, data])).digest('hex');
    const db = getAdminDb(), ref = db.collection('users').doc(uid).collection(kind).doc(recordId);
    const created = await db.runTransaction(async transaction => {
      await assertWritable(transaction, uid);
      const previous = await transaction.get(ref);
      if (previous.exists) {
        if (previous.get('writeFingerprint') !== fingerprint) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This record identifier already contains another result.');
        return false;
      }
      const commitBudget = await prepareRequestBudget(transaction, uid, 'learning-write', bytes);
      commitBudget();
      transaction.create(ref, { ...data, userId: uid, writeFingerprint: fingerprint,
        ...(kind === 'history' ? { date: Timestamp.fromMillis(data.date) } : { createdAt: FieldValue.serverTimestamp() }) });
      return true;
    });
    return NextResponse.json({ recordId }, { status: created ? 201 : 200, headers });
  } catch (error) { return apiFailure(error); }
}

/** Feedback recovery changes only analysis/topic labels, preserving completion and answers. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'learning-traffic');
    const { kind, recordId } = await params;
    if (kind !== 'history') throw new ApiError('APP-INVALID-INPUT', 400, 'Only history feedback can be updated.');
    requireDocumentId(recordId);
    const feedback = historyFeedbackSchema.parse(await readLimitedJson(request, LEARNING_LIMITS.bodyBytes));
    const db = getAdminDb(), ref = db.collection('users').doc(uid).collection('history').doc(recordId);
    await db.runTransaction(async transaction => {
      await assertWritable(transaction, uid);
      const previous = await transaction.get(ref);
      if (!previous.exists) throw new ApiError('APP-NOT-FOUND', 404, 'The learning record was not found.');
      const current = readHistoryItem(recordId, previous.data());
      if (!current) throw new ApiError('APP-DATA-INVALID', 409, 'The saved result needs review before feedback can be attached.');
      const config = { ...previous.get('config'), topicEn: feedback.topicEn, topicVi: feedback.topicVi };
      if (canonicalJson({ analysis: previous.get('analysis'), topicEn: current.config.topicEn, topicVi: current.config.topicVi }) === canonicalJson(feedback)) return;
      const bytes = checkSize({ ...previous.data(), analysis: feedback.analysis, config });
      const commitBudget = await prepareRequestBudget(transaction, uid, 'learning-write', bytes);
      commitBudget();
      transaction.update(ref, { analysis: feedback.analysis, 'config.topicEn': feedback.topicEn, 'config.topicVi': feedback.topicVi });
    });
    return NextResponse.json({ recordId }, { headers });
  } catch (error) { return apiFailure(error); }
}
