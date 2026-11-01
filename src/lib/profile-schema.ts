import { z } from 'zod';
import { readTimeMillis } from './time';
import { PROFILE_LIMITS } from './data-limits';
const profileSchema = z.object({
  displayName: z.string().max(PROFILE_LIMITS.displayName).catch(''),
  photoURL: z.string().max(PROFILE_LIMITS.photoURL).refine(value => value === '' || /^https?:\/\//i.test(value)).catch(''),
  bio: z.string().catch(''),
  createdAt: z.unknown().transform(readTimeMillis).default(null),
});
export type LearnerProfile = z.infer<typeof profileSchema>;
/** Legacy optional fields are normalized; arbitrary Firestore fields never reach the view. */
export function readLearnerProfile(value: unknown): LearnerProfile | null {
  const result = profileSchema.safeParse(value);
  return result.success ? result.data : null;
}
