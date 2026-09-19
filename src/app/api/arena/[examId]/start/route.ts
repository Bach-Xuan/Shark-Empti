import { ARENA_SESSION_TTL_MS, arenaFingerprint, arenaSessionId } from '@/lib/arena-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireDocumentId } from '@/lib/forum-deletion';
import { readArenaExam } from '@/lib/public-firestore-schema';
import { ApiError, apiFailure, authenticatedUser } from '@/lib/server-api';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
const StartSchema = z.object({ requestId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const { requestId } = StartSchema.parse(await request.json());
    const { examId } = await params;
    requireDocumentId(examId);
    const db = getAdminDb();
    const sessionRef = db.collection('_arenaSessions').doc(arenaSessionId(uid, examId, requestId));
    await db.runTransaction(async transaction => {
      const exam = await transaction.get(db.collection('arenaExams').doc(examId));
      if (!exam.exists) throw new ApiError('ARENA-NOT-FOUND', 404, 'Arena exam not found.');
      const parsed = readArenaExam(examId, exam.data());
      if (!parsed) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This exam cannot be started securely.');
      const session = await transaction.get(sessionRef);
      const now = Date.now();
      if (session.exists) {
        const previous = session.data()!;
        if (previous.result || now - previous.startedAtMs >= ARENA_SESSION_TTL_MS
          || previous.examFingerprint !== arenaFingerprint(parsed.questions)) {
          throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This attempt is no longer available. Start a new attempt.');
        }
        return; // A lost response must never reset the clock.
      }
      transaction.create(sessionRef, {
        uid, examId, startedAtMs: now, examFingerprint: arenaFingerprint(parsed.questions),
        expiresAt: new Date(now + ARENA_SESSION_TTL_MS),
      });
    });
    return NextResponse.json({ requestId });
  } catch (error) { return apiFailure(error); }
}
