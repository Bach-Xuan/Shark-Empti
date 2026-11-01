/** Shared writer/UI bounds. Rules mirror direct-write bounds and tests check parity. */
export const PROFILE_LIMITS = { displayName: 200, photoURL: 2048, bio: 20_000 } as const;
export const NOTES_MAX_LENGTH = 20_000;
export const ACTIVITY_MAX_DAYS = 5_000;
export const LEARNING_LIMITS = {
  items: 50, text: 20_000, answer: 2_000, label: 200, analysisItems: 50,
  recordBytes: 750_000, bodyBytes: 800_000, durationSeconds: 7 * 24 * 60 * 60,
} as const;
