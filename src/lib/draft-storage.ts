// Deliberately dependency-free: Auth cleanup must not import validation/AI code.
const PREFIX = 'shark:draft:v1:';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 1_000_000;
function storage() { try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; } }
const key = (owner: string, kind: string) => `${PREFIX}${encodeURIComponent(owner)}:${kind}`;
export function removeDraft(owner: string, kind: string) { try { storage()?.removeItem(key(owner, kind)); } catch { /* Recovery must not crash learning. */ } }
export function readDraft<T>(owner: string, kind: string, parse: (data: unknown) => T | null): T | null {
  try {
    const raw = storage()?.getItem(key(owner, kind));
    if (!raw) return null;
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Draft too large');
    const envelope = JSON.parse(raw);
    const now = Date.now();
    if (!Number.isFinite(envelope.expiresAt) || envelope.expiresAt <= now || envelope.expiresAt > now + DRAFT_TTL_MS) throw new Error('Draft expired');
    const value = parse(envelope.data);
    if (!value) throw new Error('Invalid draft');
    return value;
  } catch { removeDraft(owner, kind); return null; }
}
export function writeDraft(owner: string, kind: string, data: unknown): boolean {
  try {
    const target = storage();
    if (!target) return false;
    const value = JSON.stringify({ expiresAt: Date.now() + DRAFT_TTL_MS, data });
    if (new TextEncoder().encode(value).length > MAX_BYTES) return false;
    target.setItem(key(owner, kind), value);
    return true;
  } catch { return false; }
}
export function pruneDraftsForOwner(owner: string | null) {
  try {
    const target = storage();
    if (!target) return;
    const keep = owner ? key(owner, '') : null;
    const keys = Array.from({ length: target.length }, (_, index) => target.key(index));
    for (const item of keys) if (item?.startsWith(PREFIX) && (!keep || !item.startsWith(keep))) target.removeItem(item);
  } catch { /* Storage may be disabled by browser policy. */ }
}
