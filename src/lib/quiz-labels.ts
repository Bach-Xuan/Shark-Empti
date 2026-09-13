import { uiMessage } from './i18n';
import type { TranslationSet } from './translations';

/** Translate known business codes without changing stored or user-authored values. */
export function quizLabel(kind: 'subject' | 'type' | 'difficulty', value: string, t: TranslationSet): string {
  const labels: Record<typeof kind, Record<string, string>> = {
    subject: { math: t.math, physics: t.physics, chemistry: t.chemistry, biology: t.biology, literature: t.literature, english: t.english, other: t.other, none: t.none },
    type: { 'Multiple Choice': t.multipleChoice, 'True/False': t.trueFalse, 'Short Answer': t.shortAnswer, Mixed: t.mixedQuestions },
    difficulty: { Recognition: t.recognition, Comprehension: t.comprehension, Application: t.application, 'Advanced Application': t.advancedApplication, Master: t.master, Mixed: t.allLevels, Easy: t.easy, Medium: t.medium, Hard: t.hard },
  };
  return Object.hasOwn(labels[kind], value) ? labels[kind][value] : value;
}

export function errorCategoryLabel(value: string | null | undefined, t: TranslationSet, lang: string): string {
  switch (value) {
    case 'Careless Mistake': return t.carelessMistake;
    case 'Reasoning Error': return t.reasoningError;
    case 'Misinterpretation': return t.misinterpretation;
    case 'Time Expired': return uiMessage(lang, 'quiz.time_expired');
    default: return t.conceptError;
  }
}
