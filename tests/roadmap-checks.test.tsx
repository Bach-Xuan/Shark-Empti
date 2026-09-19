import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRoadmapChecks } from '@/hooks/use-roadmap-checks';
import { readRoadmapChecks, writeRoadmapChecks } from '@/lib/roadmap-storage';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it('synchronizes dashboard/report consumers, switches accounts, and isolates logout', () => {
  const dashboard = renderHook(({ uid }) => useRoadmapChecks(uid), { initialProps: { uid: 'first' as string | undefined } });
  const report = renderHook(() => useRoadmapChecks('first'));
  act(() => dashboard.result.current.toggleCheck('topic', 'task'));
  expect(report.result.current.roadmapStatus.topic.task).toBe(true);
  dashboard.rerender({ uid: 'second' });
  expect(dashboard.result.current.roadmapStatus).toEqual({});
  act(() => dashboard.result.current.toggleCheck('topic', 'other'));
  expect(readRoadmapChecks('first')).toEqual({ topic: { task: true } });
  dashboard.rerender({ uid: undefined });
  act(() => dashboard.result.current.toggleCheck('topic', 'anonymous'));
  expect(dashboard.result.current.roadmapStatus).toEqual({});
  dashboard.rerender({ uid: 'first' });
  expect(dashboard.result.current.roadmapStatus.topic.task).toBe(true);
});
it('merges fresh storage, handles cross-tab changes, and does not claim failed saves', () => {
  const { result } = renderHook(() => useRoadmapChecks('first'));
  writeRoadmapChecks('first', { topic: { another: true } });
  act(() => result.current.toggleCheck('topic', 'task'));
  expect(result.current.roadmapStatus).toEqual({ topic: { another: true, task: true } });
  act(() => { writeRoadmapChecks('first', {}); window.dispatchEvent(new StorageEvent('storage')); });
  expect(result.current.roadmapStatus).toEqual({});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  act(() => result.current.toggleCheck('topic', 'task'));
  expect(result.current.roadmapStatus).toEqual({});
});
