'use client';
import { useEffect, useState } from 'react';
import { readRoadmapChecks, writeRoadmapChecks, type RoadmapChecks } from '@/lib/roadmap-storage';

const changedEvent = 'shark-roadmap-changed';
export function useRoadmapChecks(uid: string | undefined) {
  const [snapshot, setSnapshot] = useState<{ uid?: string; checks: RoadmapChecks }>({ checks: {} });
  useEffect(() => {
    const sync = () => setSnapshot({ uid, checks: readRoadmapChecks(uid) });
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(changedEvent, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(changedEvent, sync);
    };
  }, [uid]);
  const toggleCheck = (topicId: string, recommendationId: string) => {
    if (!uid) return;
    const checks = readRoadmapChecks(uid);
    const next = { ...checks, [topicId]: { ...checks[topicId], [recommendationId]: !checks[topicId]?.[recommendationId] } };
    if (writeRoadmapChecks(uid, next)) {
      setSnapshot({ uid, checks: next });
      window.dispatchEvent(new Event(changedEvent));
    }
  };
  return { roadmapStatus: snapshot.uid === uid ? snapshot.checks : {}, toggleCheck };
}
