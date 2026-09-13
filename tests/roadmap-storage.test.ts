import { readRoadmapChecks,writeRoadmapChecks } from '@/lib/roadmap-storage';
import { afterEach,expect,it } from 'vitest';
afterEach(() => localStorage.clear());
it('isolates account progress and retains unattributed legacy storage', () => {
  localStorage.setItem('shark_roadmap_checks', '{"legacy":{"0":true}}');
  expect(readRoadmapChecks('second')).toEqual({});
  expect(writeRoadmapChecks('first', { algebra: { 0: true } })).toBe(true);
  expect(readRoadmapChecks('first')).toEqual({ algebra: { 0: true } });
  expect(readRoadmapChecks('second')).toEqual({});
  expect(localStorage.getItem('shark_roadmap_checks')).toContain('legacy');
});
it('rejects corrupt or invalid saved values', () => {
  localStorage.setItem('shark_roadmap_checks:first', '{"algebra":{"0":"true"}}');
  expect(readRoadmapChecks('first')).toEqual({});
  expect(readRoadmapChecks(undefined)).toEqual({});
});
