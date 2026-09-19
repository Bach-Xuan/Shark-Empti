import { z } from 'zod';
export type RoadmapChecks = Record<string, Record<string, boolean>>;
const schema = z.record(z.string(), z.record(z.string(), z.boolean()));
const keyFor = (uid: string) => `shark_roadmap_checks:v2:${uid}`;
/**
 * Non-destructive legacy policy: neither the unscoped key nor v1 account keys
 * are imported, overwritten, or removed. Their localized topics/indices cannot
 * prove task identity (or, for the unscoped key, account ownership). V2 starts
 * empty; old bytes remain available for an explicit, user-reviewed recovery.
 */
export function readRoadmapChecks(uid: string | undefined): RoadmapChecks {
  if (!uid) return {};
  try { const parsed = schema.safeParse(JSON.parse(localStorage.getItem(keyFor(uid)) || '{}')); return parsed.success ? parsed.data : {}; }
  catch { return {}; }
}
export function writeRoadmapChecks(uid: string | undefined, checks: RoadmapChecks): boolean {
  if (!uid) return false;
  try { localStorage.setItem(keyFor(uid), JSON.stringify(checks)); return true; }
  catch { return false; }
}
