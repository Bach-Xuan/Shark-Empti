import type { TranslationSet } from './translations';
export const SUBJECT_IDS = ['literature', 'math', 'physics', 'chemistry', 'biology', 'english', 'other'] as const;
export function subjectOptions(t: TranslationSet) { return SUBJECT_IDS.map(id => ({ id, label: t[id] })); }
