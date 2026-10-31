import { formatStoredDate, formatForumDate } from '@/lib/date-format';
import { expect,it } from 'vitest';
it('formats Timestamp and ISO inputs consistently in each locale', () => {
  const date = new Date('2026-09-03T12:00:00Z');
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } as const;
  expect(formatStoredDate({ toDate: () => date }, 'en', options)).toBe('September 3, 2026');
  expect(formatStoredDate(date.toISOString(), 'vi', options)).toContain('tháng 9');
});
it('does not crash on missing or corrupt legacy timestamps', () => {
  expect(formatStoredDate(null, 'vi')).toBe('...');
  expect(formatStoredDate('invalid', 'en')).toBe('...');
  expect(formatForumDate({ createdAt: 0, updatedAt: 0 }, 'en', 'edited')).toContain('(edited)');
  expect(formatForumDate({ createdAt: 0, updatedAt: 'invalid' }, 'en', 'edited')).not.toContain('(edited)');
});
