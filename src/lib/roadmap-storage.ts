import { z } from 'zod';
export type RoadmapChecks = Record<string, Record<number, boolean>>;
const schema = z.record(z.string(), z.record(z.string(), z.boolean()));
const keyFor = (uid: string) => `shark_roadmap_checks:${uid}`;
/** The unscoped legacy key is retained but cannot safely be assigned to an account. */
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
