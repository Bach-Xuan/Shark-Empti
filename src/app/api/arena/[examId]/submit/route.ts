import { calculateArenaScore, answersMatch } from '@/lib/arena-scoring';
import { ARENA_SESSION_TTL_MS,arenaFingerprint,arenaSessionId } from '@/lib/arena-session';
import { readArenaExam } from '@/lib/public-firestore-schema';
import { requireDocumentId } from '@/lib/forum-deletion';
import { getAdminAuth,getAdminDb } from '@/lib/firebase-admin';
import { ApiError,apiFailure,authenticatedUser,idempotentTransaction } from '@/lib/server-api';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readLimitedJson } from '@/lib/server-json';
import { readArenaKey } from '@/lib/arena-keys';
import { prepareRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';

const SubmitSchema = z.object({ answers: z.array(z.string().max(2000)).max(50), requestId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const payload = SubmitSchema.parse(await readLimitedJson(request, 128_000));
    const receivedAt = Date.now();
    const { examId } = await params;
    requireDocumentId(examId);
    const decoded = await adminAuth.getUser(uid);
    const result = await idempotentTransaction(`arena/${examId}`, uid, payload.requestId, { answers: payload.answers }, async transaction => {
      const examRef = adminDb.collection('arenaExams').doc(examId);
      const exam = await transaction.get(examRef);
      if (!exam.exists) throw new ApiError('ARENA-NOT-FOUND', 404, 'Arena exam not found.');

      const parsed = readArenaExam(examId, exam.data());
      if (!parsed || parsed.schemaVersion !== 2 || parsed.totalAttempts >= Number.MAX_SAFE_INTEGER) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This exam needs a secure migration.');
      const key = await transaction.get(adminDb.collection('_arenaAnswerKeys').doc(examId));
      const questions = readArenaKey(key.data(), parsed.authorId, Number(parsed.config.numQuestions));
      if (questions.length !== payload.answers!.length) throw new ApiError('APP-INVALID-INPUT', 400, 'Answers do not match this exam.');

      const sessionRef = adminDb.collection('_arenaSessions').doc(arenaSessionId(uid, examId, payload.requestId));
      const session = await transaction.get(sessionRef);
      const timing = session.data();
      if (!timing || timing.protocolVersion !== 2 || timing.uid !== uid || timing.examId !== examId
        || !Number.isSafeInteger(timing.startedAtMs) || receivedAt < timing.startedAtMs
        || receivedAt - timing.startedAtMs >= ARENA_SESSION_TTL_MS
        || timing.examFingerprint !== arenaFingerprint(questions)) {
        throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Start a new attempt before submitting.');
      }
      const answerFingerprint = arenaFingerprint(payload.answers);
      if (timing.result) {
        if (timing.answerFingerprint !== answerFingerprint) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This attempt was already submitted.');
        return timing.result as { score: number; coinsAwarded: number; isFirstAttempt: boolean; duration: number; ranked: boolean };
      }
      const duration = Math.max(1, Math.ceil((receivedAt - timing.startedAtMs) / 1000));

      const score = calculateArenaScore(questions, payload.answers as string[]);
      const rankedRef = examRef.collection('attempts').doc(createHash('sha256').update(uid).digest('hex'));
      const previousRank = await transaction.get(rankedRef);
      const limitMs = parsed.config.timeLimit ? Number(parsed.config.timeLimit) * 60_000 + 5000 : ARENA_SESSION_TTL_MS;
      const ranked = timing.eligibleForRanking === true && !parsed.practiceOnly && parsed.authorId !== uid && !previousRank.exists && receivedAt - timing.startedAtMs <= limitMs;
      const isFirstAttempt = ranked && exam.get('firstRewardClaimed') !== true;
      const coinsAwarded = ranked ? score + (isFirstAttempt ? 50 : 0) : 0;
      const commitBudget = await prepareRequestBudget(transaction, uid, 'arena-submit');
      commitBudget();
      if (ranked) transaction.create(rankedRef, {
        examId,
        userId: uid,
        userName: decoded.displayName || 'Learner',
        userPhoto: decoded.photoURL || '',
        score,
        duration,
        timingVersion: 1,
        rankingVersion: 2,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(examRef, { totalAttempts: parsed.totalAttempts + 1, ...(isFirstAttempt ? { firstRewardClaimed: true } : {}) });
      if (coinsAwarded) transaction.set(adminDb.collection('users').doc(uid), { sharkCoins: FieldValue.increment(coinsAwarded) }, { merge: true });
      const result = { score, coinsAwarded, isFirstAttempt, duration, ranked };
      transaction.update(sessionRef, { result, answerFingerprint });
      return result;
    });
    const key = await adminDb.collection('_arenaAnswerKeys').doc(examId).get();
    const questions = readArenaKey(key.data(), key.get('authorId'), payload.answers.length);
    // The receipt/session stores only the compact result, not a duplicate answer bank.
    if (!Array.isArray(questions) || questions.length !== payload.answers.length) throw new ApiError('ARENA-REVIEW-UNAVAILABLE', 503, 'Your result was saved; retry the same submission to recover review.');
    const reviewResults = questions.map((question, index) => ({ ...question, userAnswer: payload.answers[index], isCorrect: answersMatch(question, payload.answers[index]), timeTakenSeconds: 0, errorCategory: null, aiFeedback: null }));
    return NextResponse.json({ ...result, reviewResults });
  } catch (error) {
    return apiFailure(error);
  }
}
