import { calculateArenaScore } from '@/lib/arena-scoring';
import { ARENA_SESSION_TTL_MS,arenaFingerprint,arenaSessionId } from '@/lib/arena-session';
import { readArenaExam } from '@/lib/public-firestore-schema';
import { requireDocumentId } from '@/lib/forum-deletion';
import { getAdminAuth,getAdminDb } from '@/lib/firebase-admin';
import { ApiError,apiFailure,authenticatedUser,idempotentTransaction } from '@/lib/server-api';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const SubmitSchema = z.object({ answers: z.array(z.string().max(2000)).max(500), requestId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const payload = SubmitSchema.parse(await request.json());
    const receivedAt = Date.now();
    const { examId } = await params;
    requireDocumentId(examId);
    const decoded = await adminAuth.getUser(uid);
    const result = await idempotentTransaction(`arena/${examId}`, uid, payload.requestId, { answers: payload.answers }, async transaction => {
      const examRef = adminDb.collection('arenaExams').doc(examId);
      const exam = await transaction.get(examRef);
      if (!exam.exists) throw new ApiError('ARENA-NOT-FOUND', 404, 'Arena exam not found.');

      const parsed = readArenaExam(examId, exam.data());
      if (!parsed || parsed.totalAttempts >= Number.MAX_SAFE_INTEGER) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This legacy exam cannot be submitted securely.');
      const questions = parsed.questions;
      if (questions.length !== payload.answers!.length) throw new ApiError('APP-INVALID-INPUT', 400, 'Answers do not match this exam.');

      const sessionRef = adminDb.collection('_arenaSessions').doc(arenaSessionId(uid, examId, payload.requestId));
      const session = await transaction.get(sessionRef);
      const timing = session.data();
      if (!timing || timing.uid !== uid || timing.examId !== examId
        || !Number.isSafeInteger(timing.startedAtMs) || receivedAt < timing.startedAtMs
        || receivedAt - timing.startedAtMs >= ARENA_SESSION_TTL_MS
        || timing.examFingerprint !== arenaFingerprint(questions)) {
        throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Start a new attempt before submitting.');
      }
      const answerFingerprint = arenaFingerprint(payload.answers);
      if (timing.result) {
        if (timing.answerFingerprint !== answerFingerprint) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This attempt was already submitted.');
        return timing.result as { score: number; coinsAwarded: number; isFirstAttempt: boolean };
      }
      const duration = Math.max(1, Math.ceil((receivedAt - timing.startedAtMs) / 1000));

      const score = calculateArenaScore(questions, payload.answers as string[]);
      const isFirstAttempt = parsed.totalAttempts === 0;
      const coinsAwarded = score + (isFirstAttempt ? 50 : 0);
      transaction.create(examRef.collection('attempts').doc(), {
        examId,
        userId: uid,
        userName: decoded.displayName || 'Learner',
        userPhoto: decoded.photoURL || '',
        score,
        duration,
        timingVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(examRef, { totalAttempts: parsed.totalAttempts + 1 });
      transaction.set(adminDb.collection('users').doc(uid), { sharkCoins: FieldValue.increment(coinsAwarded) }, { merge: true });
      const result = { score, coinsAwarded, isFirstAttempt };
      transaction.update(sessionRef, { result, answerFingerprint });
      return result;
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiFailure(error);
  }
}
