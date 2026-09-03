import { z } from 'zod';
const profileSchema = z.object({
  displayName: z.string().catch(''),
  photoURL: z.string().catch(''),
  bio: z.string().catch(''),
  createdAt: z.unknown().optional(),
});
export type LearnerProfile = z.infer<typeof profileSchema>;
/** Legacy optional fields are normalized; arbitrary Firestore fields never reach the view. */
export function readLearnerProfile(value: unknown): LearnerProfile | null {
  const result = profileSchema.safeParse(value);
  return result.success ? result.data : null;
}
