import { Timestamp } from 'firebase/firestore';
import { expect, it } from 'vitest';
import { readTimeMillis } from '@/lib/time';
import { readHistoryItem } from '@/lib/history-schema';
import { history } from './fixtures/quiz';

it('normalizes SDK timestamps, legacy UTC/offset dates and JSON milliseconds to the same instant', () => {
  const millis = Date.parse('2026-09-03T12:00:00Z');
  for (const value of [millis, new Date(millis), Timestamp.fromMillis(millis), '2026-09-03T12:00:00.000Z']) {
    expect(readTimeMillis(value)).toBe(millis);
    expect(readHistoryItem('same', { ...history, date: value })?.date).toBe(millis);
  }
  expect(readTimeMillis('2026-09-03T19:00:00+07:00')).toBe(millis);
  expect(readHistoryItem('requires-migration', { ...history, date: '2026-09-03T19:00:00+07:00' })).toBeNull();
  expect(readTimeMillis('2026-09-03')).toBe(Date.parse('2026-09-03T00:00:00Z'));
  expect(readTimeMillis(0)).toBe(0);
});

it.each([undefined, null, '', '09/03/2026', '2026-02-30', '2026-02-30T12:00:00Z', '2026-09-03T12:00:00', NaN, Infinity, new Date(NaN), {}, { toDate() { throw Error('Invalid'); } }])('rejects ambiguous or invalid persisted dates %#', value => {
  expect(readTimeMillis(value)).toBeNull();
  expect(readHistoryItem('invalid', { ...history, date: value })).toBeNull();
});
