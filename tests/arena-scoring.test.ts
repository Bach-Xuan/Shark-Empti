import { describe, expect, it } from 'vitest';
import { answersMatch, calculateArenaScore, isTrustedArenaExam, parseNumericAnswer } from '@/lib/arena-scoring';

describe('Arena numeric scoring', () => {
  it('normalizes decimal separators and rejects prose or units', () => {
    expect(parseNumericAnswer(' 1,5 ')).toBe(1.5);
    expect(parseNumericAnswer('1.5 kg')).toBeNull();
    expect(parseNumericAnswer('one point five')).toBeNull();
  });

  it('accepts numeric answers within the documented tolerance', () => {
    expect(answersMatch({ question: 'x', type: 'Short Answer', correct: '0.3' }, '0,3000005')).toBe(true);
    expect(answersMatch({ question: 'x', type: 'Short Answer', correct: '0.3' }, '0.31')).toBe(false);
  });

  it('scores a full answer set and rejects legacy free-text short answers', () => {
    const questions = [
      { question: 'q1', type: 'Multiple Choice', correct: 'A' },
      { question: 'q2', type: 'Short Answer', correct: '42' },
    ];
    expect(calculateArenaScore(questions, ['a', '42.0000001'])).toBe(100);
    expect(isTrustedArenaExam(questions)).toBe(true);
    expect(isTrustedArenaExam([{ question: 'q', type: 'Short Answer', correct: 'forty two' }])).toBe(false);
  });
});
