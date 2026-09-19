import {
CognitiveMetrics,
Language,
QuizHistoryItem,
} from "./types";

import { uiMessage } from './i18n';
import { TranslationSet } from "./translations";
import { roadmapTopicId, roadmapRecommendations, type RoadmapRecommendation } from './roadmap-identity';

export interface DashboardStats {
  totalAttempts: number;
  totalErrors: number;
  mostFrequentError: string;
  radarData: Array<{ subject: string; A: number | null }>;
  barData: Array<{ name: string; count: number }>;
  processedGroupedInsights: Array<{
    topicId: string;
    topic: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: RoadmapRecommendation[];
    errorCount: number;
    totalQuestions: number;
    errorRate: number;
  }>;
}

const ERROR_TYPES = [
  "Concept Error",
  "Reasoning Error",
  "Careless Mistake",
  "Misinterpretation",
  "Time Expired",
] as const;

type ErrorType = (typeof ERROR_TYPES)[number];

interface TopicInsight {
  topic: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: RoadmapRecommendation[];
  errorCount: number;
  totalQuestions: number;
}

interface LocalizedAnalysis {
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

type SessionAnalysis = {
  cognitiveMetrics?: CognitiveMetrics;
} & Partial<Record<Language, LocalizedAnalysis>>;

const createEmptyTopicInsight = (): TopicInsight => ({
  topic: '',
  strengths: [],
  weaknesses: [],
  recommendations: [],
  errorCount: 0,
  totalQuestions: 0,
});

const createEmptyMetrics = (): CognitiveMetrics => ({
  conceptMastery: 0,
  applicationSkill: 0,
  problemDecomposition: 0,
  logicalReasoning: 0,
  errorAwareness: 0,
  instructionFollowing: 0,
});

export function calculateDashboardStats(
  history: QuizHistoryItem[],
  t: TranslationSet,
  currentLang: Language
): DashboardStats | null {
  if (!history?.length) {
    return null;
  }

  const totalAttempts = history.length;
  let totalErrors = 0;

  const errorFrequency: Record<ErrorType, number> =
    ERROR_TYPES.reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      Object.create(null) as Record<ErrorType, number>
    );

  const cumulativeMetrics = createEmptyMetrics();
  const metricCounts = createEmptyMetrics();

  const topicInsights = new Map<string, TopicInsight>();

  // Deterministic recency ordering also makes capped lists independent of fetch order.
  [...history].sort((a, b) => a.date.localeCompare(b.date) ||
    (a.id ?? JSON.stringify(a.config)).localeCompare(b.id ?? JSON.stringify(b.config))).forEach(session => {
    const topic =
      currentLang === "vi"
        ? session.config.topicVi || session.config.topic
        : session.config.topicEn || session.config.topic;

    const topicId = roadmapTopicId(session.config);
    const currentTopic = topicInsights.get(topicId) ?? createEmptyTopicInsight();
    currentTopic.topic = topic;
    topicInsights.set(topicId, currentTopic);

    currentTopic.totalQuestions += session.quizResults.length;

    session.quizResults.forEach(result => {
      if (result.isCorrect) return;

      totalErrors++;
      currentTopic.errorCount++;

      const errorType = (result.errorCategory || "Concept Error") as ErrorType;

      errorFrequency[errorType] = (errorFrequency[errorType] || 0) + 1;
    });

    if (!session.analysis) return;

    const metrics = session.analysis.cognitiveMetrics;

    if (metrics) {
      (Object.keys(cumulativeMetrics) as Array<keyof CognitiveMetrics>).forEach(key => {
        const value = metrics[key];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
          cumulativeMetrics[key] += value;
          metricCounts[key]++;
        }
      });
    }

    const analysis = (session.analysis as SessionAnalysis)[currentLang];

    currentTopic.recommendations.push(...roadmapRecommendations(session, currentLang));
    if (!analysis) return;

    currentTopic.strengths.push(...(analysis.strengths || []));
    currentTopic.weaknesses.push(...(analysis.weaknesses || []));
  });

  const averageMetrics: Record<keyof CognitiveMetrics, number | null> = {
    ...cumulativeMetrics,
  };

  (Object.keys(averageMetrics) as Array<keyof CognitiveMetrics>).forEach(key => {
    averageMetrics[key] = metricCounts[key] ? cumulativeMetrics[key] / metricCounts[key] : null;
  });

  const processedGroupedInsights = Array.from(topicInsights.entries())
    .map(([topicId, data]) => ({
      topicId,
      topic: data.topic,
      strengths: [...new Set(data.strengths)].slice(-3).reverse(),
      weaknesses: [...new Set(data.weaknesses)].slice(-3).reverse(),
      recommendations: [...new Map(data.recommendations.map(rec => [rec.id, rec])).values()].slice(-5).reverse(),
      errorCount: data.errorCount,
      totalQuestions: data.totalQuestions,
      errorRate:
        data.totalQuestions > 0 ? data.errorCount / data.totalQuestions : 0,
    }))
    .filter(
      group =>
        group.strengths.length ||
        group.weaknesses.length ||
        group.recommendations.length
    );

  const errorLabels = {
    "Concept Error": t.conceptError,
    "Reasoning Error": t.reasoningError,
    "Careless Mistake": t.carelessMistake,
    Misinterpretation: t.misinterpretation,
    'Time Expired': uiMessage(currentLang, 'quiz.time_expired'),
  };

  const dominantError = Object.entries(errorFrequency).reduce((prev, current) =>
    current[1] >= prev[1] ? current : prev
  );

  const mostFrequentError =
    dominantError[1] > 0
      ? errorLabels[dominantError[0] as keyof typeof errorLabels] ||
        dominantError[0]
      : t.none;

  return {
    totalAttempts,
    totalErrors,
    mostFrequentError,
    radarData: [
      {
        subject: t.conceptMastery,
        A: averageMetrics.conceptMastery,
      },
      {
        subject: t.applicationSkill,
        A: averageMetrics.applicationSkill,
      },
      {
        subject: t.problemDecomposition,
        A: averageMetrics.problemDecomposition,
      },
      {
        subject: t.logicalReasoning,
        A: averageMetrics.logicalReasoning,
      },
      {
        subject: t.errorAwareness,
        A: averageMetrics.errorAwareness,
      },
      {
        subject: t.instructionFollowing,
        A: averageMetrics.instructionFollowing,
      },
    ],
    barData: Object.entries(errorFrequency).map(([key, count]) => ({
      name: errorLabels[key as keyof typeof errorLabels] || key,
      count,
    })),
    processedGroupedInsights,
  };
}
