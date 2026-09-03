import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { calculateArenaScore, isTrustedArenaExam, type ArenaQuestion } from '@/lib/arena-scoring';

export const runtime = 'nodejs';

type SubmitPayload = { answers?: unknown; duration?: unknown };

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return failure('Authentication is required.', 401);

  let uid: string;
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  try {
    uid = (await adminAuth.verifyIdToken(authorization.slice(7))).uid;
  } catch {
    return failure('Authentication is invalid or expired.', 401);
  }

  const payload = await request.json().catch((): SubmitPayload => ({}));
  if (!Array.isArray(payload.answers) || !payload.answers.every((answer: unknown) => typeof answer === 'string')) {
    return failure('Answers must be an array of strings.', 400);
  }
  const duration = typeof payload.duration === 'number' && Number.isFinite(payload.duration)
    ? Math.max(0, Math.round(payload.duration))
    : 0;
  const { examId } = await params;

  try {
    const result = await adminDb.runTransaction(async transaction => {
      const examRef = adminDb.collection('arenaExams').doc(examId);
      const exam = await transaction.get(examRef);
      if (!exam.exists) throw new Error('NOT_FOUND');

      const questions = exam.get('questions') as ArenaQuestion[] | undefined;
      if (!Array.isArray(questions) || !isTrustedArenaExam(questions)) throw new Error('LEGACY_EXAM');
      if (questions.length !== payload.answers!.length) throw new Error('INVALID_ANSWERS');

      const score = calculateArenaScore(questions, payload.answers as string[]);
      const attempts = await transaction.get(adminDb.collection('arenaExams').doc(examId).collection('attempts'));
      const isFirstAttempt = attempts.empty;
      const coinsAwarded = score + (isFirstAttempt ? 50 : 0);
      const decoded = await adminAuth.getUser(uid);

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
      transaction.update(adminDb.collection('users').doc(uid), { sharkCoins: FieldValue.increment(coinsAwarded) });
      return { score, coinsAwarded, isFirstAttempt };
    });
    return NextResponse.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'UNKNOWN';
    if (reason === 'NOT_FOUND') return failure('Arena exam not found.', 404);
    if (reason === 'LEGACY_EXAM') return failure('This legacy exam cannot be submitted securely.', 409);
    if (reason === 'INVALID_ANSWERS') return failure('Answers do not match this exam.', 400);
    console.error('Arena submission failed', error);
    return failure('Could not save the Arena attempt.', 500);
  }
}
