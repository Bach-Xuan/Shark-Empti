import { calculateArenaScore,isTrustedArenaExam,type ArenaQuestion } from '@/lib/arena-scoring';
import { getAdminAuth,getAdminDb } from '@/lib/firebase-admin';
import { ApiError,apiFailure,authenticatedUser,idempotentTransaction } from '@/lib/server-api';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const SubmitSchema = z.object({ answers: z.array(z.string().max(2000)).max(500), duration: z.number().finite().optional(), requestId: z.string().uuid().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const payload = SubmitSchema.parse(await request.json());
    const duration = Math.max(0, Math.round(payload.duration ?? 0));
    const { examId } = await params;
    const decoded = await adminAuth.getUser(uid);
    const result = await idempotentTransaction(`arena/${examId}`, uid, payload.requestId, { answers: payload.answers, duration }, async transaction => {
      const examRef = adminDb.collection('arenaExams').doc(examId);
      const exam = await transaction.get(examRef);
      if (!exam.exists) throw new ApiError('ARENA-NOT-FOUND', 404, 'Arena exam not found.');

      const questions = exam.get('questions') as ArenaQuestion[] | undefined;
      if (!Array.isArray(questions) || !isTrustedArenaExam(questions)) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This legacy exam cannot be submitted securely.');
      if (questions.length !== payload.answers!.length) throw new ApiError('APP-INVALID-INPUT', 400, 'Answers do not match this exam.');

      const score = calculateArenaScore(questions, payload.answers as string[]);
      const totalAttempts = exam.get('totalAttempts');
      const isFirstAttempt = typeof totalAttempts !== 'number' || totalAttempts === 0;
      const coinsAwarded = score + (isFirstAttempt ? 50 : 0);
      transaction.create(examRef.collection('attempts').doc(), {
        examId,
        userId: uid,
        userName: decoded.displayName || 'Learner',
        userPhoto: decoded.photoURL || '',
        score,
        duration,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(examRef, { totalAttempts: FieldValue.increment(1) });
      transaction.set(adminDb.collection('users').doc(uid), { sharkCoins: FieldValue.increment(coinsAwarded) }, { merge: true });
      return { score, coinsAwarded, isFirstAttempt };
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiFailure(error);
  }
}
