import { ARENA_SESSION_TTL_MS, arenaFingerprint, arenaSessionId } from '@/lib/arena-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireDocumentId } from '@/lib/forum-deletion';
import { readArenaExam } from '@/lib/public-firestore-schema';
import { ApiError, apiFailure, authenticatedUser } from '@/lib/server-api';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readLimitedJson } from '@/lib/server-json';
import { readArenaKey, publicPrompts } from '@/lib/arena-keys';
import { prepareRequestBudget } from '@/lib/request-budget';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
const StartSchema = z.object({ requestId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const { requestId } = StartSchema.parse(await readLimitedJson(request, 4096));
    const { examId } = await params;
    requireDocumentId(examId);
    const db = getAdminDb();
    const sessionRef = db.collection('_arenaSessions').doc(arenaSessionId(uid, examId, requestId));
    const prompts = await db.runTransaction(async transaction => {
      const exam = await transaction.get(db.collection('arenaExams').doc(examId));
      if (!exam.exists) throw new ApiError('ARENA-NOT-FOUND', 404, 'Arena exam not found.');
      const parsed = readArenaExam(examId, exam.data());
      if (!parsed || parsed.schemaVersion !== 2) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This exam needs a secure migration.');
      const key = await transaction.get(db.collection('_arenaAnswerKeys').doc(examId));
      const questions = readArenaKey(key.data(), parsed.authorId, Number(parsed.config.numQuestions));
      const session = await transaction.get(sessionRef);
      const now = Date.now();
      if (session.exists) {
        const previous = session.data()!;
        if (previous.result || now - previous.startedAtMs >= ARENA_SESSION_TTL_MS
          || previous.protocolVersion !== 2 || previous.examFingerprint !== arenaFingerprint(questions)) {
          throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This attempt is no longer available. Start a new attempt.');
        }
        return { questions: publicPrompts(questions), startedAtMs: previous.startedAtMs }; // A replay never resets the clock.
      }
      const commitBudget = await prepareRequestBudget(transaction, uid, 'arena-start');
      const eligibilityRef = db.collection('_arenaEligibility').doc(createHash('sha256').update(JSON.stringify([uid, examId])).digest('hex'));
      const eligibility = await transaction.get(eligibilityRef);
      const rank = await transaction.get(db.collection('arenaExams').doc(examId).collection('attempts').doc(createHash('sha256').update(uid).digest('hex')));
      const firstStartedAtMs = eligibility.get('firstStartedAtMs') ?? now;
      const eligibleForRanking = !parsed.practiceOnly && parsed.authorId !== uid && !rank.exists
        && Number.isSafeInteger(firstStartedAtMs) && firstStartedAtMs <= now && now - firstStartedAtMs < ARENA_SESSION_TTL_MS;
      commitBudget();
      if (!eligibility.exists && !parsed.practiceOnly && parsed.authorId !== uid) transaction.create(eligibilityRef, { uid, examId, firstStartedAtMs: now });
      transaction.create(sessionRef, {
        uid, examId, protocolVersion: 2, eligibleForRanking, startedAtMs: eligibleForRanking ? firstStartedAtMs : now, examFingerprint: arenaFingerprint(questions),
        expiresAt: new Date(now + ARENA_SESSION_TTL_MS),
      });
      return { questions: publicPrompts(questions), startedAtMs: eligibleForRanking ? firstStartedAtMs : now };
    });
    return NextResponse.json({ requestId, ...prompts });
  } catch (error) { return apiFailure(error); }
}
