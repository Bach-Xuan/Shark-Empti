import type { Language, QuizHistoryItem } from './types';

export interface RoadmapRecommendation { id: string; text: string }

// Lossless tuple encoding avoids hash collisions. Identity uses stored content,
// never the display locale, history position, or rendered recommendation index.
export function roadmapTopicId(config: QuizHistoryItem['config']): string {
  return JSON.stringify([config.subject, config.grade, config.topic]);
}

export function roadmapRecommendations(session: QuizHistoryItem, lang: Language): RoadmapRecommendation[] {
  const en = session.analysis?.en?.recommendations ?? [];
  const vi = session.analysis?.vi?.recommendations ?? [];
  const result = new Map<string, RoadmapRecommendation>();
  for (let i = 0; i < Math.max(en.length, vi.length); i++) {
    // The persisted bilingual pair is one task. Exact duplicate pairs collapse;
    // different pairs remain separate even when one translation is identical.
    // Edited translations intentionally create a new task rather than guessing.
    const id = JSON.stringify([en[i] ?? null, vi[i] ?? null]);
    const text = (lang === 'vi' ? vi[i] ?? en[i] : en[i] ?? vi[i]) ?? '';
    if (text.trim()) result.set(id, { id, text });
  }
  return [...result.values()];
}
