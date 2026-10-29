import type { TranslationSet } from './translations';
export const SUBJECT_IDS = ['literature', 'math', 'physics', 'chemistry', 'biology', 'english', 'other'] as const;
export function subjectOptions(t: TranslationSet) { return SUBJECT_IDS.map(id => ({ id, label: t[id] })); }

/** One palette for feed and detail badges, including legible dark-mode text. */
export function subjectBadgeClassName(id: string): string {
  switch (id) {
    case 'math': return 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20';
    case 'physics': return 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/20';
    case 'chemistry': return 'bg-green-500/10 text-green-800 dark:text-green-300 border-green-500/20';
    case 'biology': return 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20';
    case 'literature': return 'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/20';
    case 'english': return 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/20';
    default: return 'bg-muted/50 text-muted-foreground border-border';
  }
}
