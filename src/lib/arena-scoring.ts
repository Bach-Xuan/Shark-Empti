/** Absolute tolerance in the answer's stated unit, not a percentage.
 * One millionth accommodates decimal rounding in school-level scalar answers.
 * Units, fractions and scientific notation require another grading policy;
 * scaling tolerance with magnitude would incorrectly accept larger errors.
 * IEEE-754 precision still limits distinguishable decimals at large magnitudes. */
export const NUMERIC_ANSWER_TOLERANCE = 1e-6;

export interface ArenaQuestion {
  question: string;
  type: string;
  correct: string;
}

/** Parses the intentionally narrow numeric-answer format used by Arena. */
export function parseNumericAnswer(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function answersMatch(question: ArenaQuestion, answer: string): boolean {
  if (question.type !== 'Short Answer') {
    return answer.trim().toLocaleLowerCase() === question.correct.trim().toLocaleLowerCase();
  }

  const expected = parseNumericAnswer(question.correct);
  const actual = parseNumericAnswer(answer);
  return expected !== null && actual !== null && Math.abs(expected - actual) <= NUMERIC_ANSWER_TOLERANCE;
}

export function isTrustedArenaExam(questions: ArenaQuestion[]): boolean {
  return questions.every(question =>
    question.type !== 'Short Answer' || parseNumericAnswer(question.correct) !== null
  );
}

export function calculateArenaScore(questions: ArenaQuestion[], answers: string[]): number {
  if (!questions.length || questions.length !== answers.length) return 0;
  const correctCount = questions.filter((question, index) => answersMatch(question, answers[index])).length;
  return Math.round((correctCount / questions.length) * 100);
}
