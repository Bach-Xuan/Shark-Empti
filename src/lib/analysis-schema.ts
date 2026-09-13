import { z } from 'zod';
export const cognitiveMetricsSchema = z.object({
 conceptMastery: z.number().min(0).max(100), applicationSkill: z.number().min(0).max(100),
 problemDecomposition: z.number().min(0).max(100), logicalReasoning: z.number().min(0).max(100),
 errorAwareness: z.number().min(0).max(100), instructionFollowing: z.number().min(0).max(100),
});
export const languageAnalysisSchema = z.object({ strengths: z.array(z.string()), weaknesses: z.array(z.string()), recommendations: z.array(z.string()) });
