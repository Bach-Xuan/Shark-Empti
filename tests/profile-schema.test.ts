import { expect, it } from 'vitest';
import { readLearnerProfile } from '@/lib/profile-schema';
it('normalizes legacy optional fields without accepting non-string display data', () => {
  expect(readLearnerProfile({ displayName: 'Learner', bio: { invalid: true }, unrelated: 'ignored' })).toEqual({ displayName: 'Learner', bio: '', photoURL: '' });
  expect(readLearnerProfile(null)).toBeNull();
});
