import { readRoadmapChecks,writeRoadmapChecks } from '@/lib/roadmap-storage';
import { afterEach,expect,it,vi } from 'vitest';
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('isolates account progress and retains unattributed legacy storage', () => {
  localStorage.setItem('shark_roadmap_checks', '{"legacy":{"0":true}}');
  const legacy = '{"algebra":{"0":true,"1":false}}';
  localStorage.setItem('shark_roadmap_checks:first', legacy);
  expect(readRoadmapChecks('first')).toEqual({});
  expect(readRoadmapChecks('second')).toEqual({});
  expect(writeRoadmapChecks('first', { algebra: { practice: true } })).toBe(true);
  expect(readRoadmapChecks('first')).toEqual({ algebra: { practice: true } });
  expect(readRoadmapChecks('second')).toEqual({});
  expect(localStorage.getItem('shark_roadmap_checks')).toContain('legacy');
  expect(localStorage.getItem('shark_roadmap_checks:first')).toBe(legacy);
});
it('rejects corrupt or invalid saved values', () => {
  localStorage.setItem('shark_roadmap_checks:v2:first', '{"algebra":{"0":"true"}}');
  expect(readRoadmapChecks('first')).toEqual({});
  expect(readRoadmapChecks(undefined)).toEqual({});
});
it('handles unavailable storage and refuses anonymous writes', () => {
  expect(writeRoadmapChecks(undefined, {})).toBe(false);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(readRoadmapChecks('first')).toEqual({});
  expect(writeRoadmapChecks('first', {})).toBe(false);
});
it.each(['{', 'null', '[]', '{"topic":true}'])('rejects corrupt v2 storage: %s', value => {
  localStorage.setItem('shark_roadmap_checks:v2:first', value);
  expect(readRoadmapChecks('first')).toEqual({});
  expect(localStorage.getItem('shark_roadmap_checks:v2:first')).toBe(value);
});
