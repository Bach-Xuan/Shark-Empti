import { z } from 'zod';
import { LEARNING_LIMITS } from './data-limits';
export const cognitiveMetricsSchema = z.object({
 conceptMastery: z.number().min(0).max(100), applicationSkill: z.number().min(0).max(100),
 problemDecomposition: z.number().min(0).max(100), logicalReasoning: z.number().min(0).max(100),
 errorAwareness: z.number().min(0).max(100), instructionFollowing: z.number().min(0).max(100),
});
const statements = z.array(z.string().max(LEARNING_LIMITS.text)).max(LEARNING_LIMITS.analysisItems);
// Legacy history remains readable; producers and new writes use the bounded contract.
export const languageAnalysisSchema = z.object({ strengths: z.array(z.string()), weaknesses: z.array(z.string()), recommendations: z.array(z.string()) });
export const boundedLanguageAnalysisSchema = languageAnalysisSchema.extend({ strengths: statements, weaknesses: statements, recommendations: statements }).strict();
