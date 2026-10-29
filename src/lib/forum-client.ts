import type { User } from 'firebase/auth';

export async function communityRequest(user: Pick<User, 'getIdToken'>, path: string, body: unknown, method = 'POST', signal?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw { code: 'APP-UNAVAILABLE', values: {} };
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 30_000);
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const failAbort = () => rejectAbort({ code: 'APP-UNAVAILABLE', values: {} });
  controller.signal.addEventListener('abort', failAbort, { once: true });
  try {
    const token = await Promise.race([user.getIdToken(), aborted]);
    if (controller.signal.aborted) throw { code: 'APP-UNAVAILABLE', values: {} };
    const response = await fetch(path, { method, signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string' && /^(?:APP|AUTH|FORUM|COMMUNITY)-[A-Z0-9-]{1,60}$/.test(payload.code) ? payload.code : 'APP-REQUEST-FAILED';
      throw { code, message: 'The community request could not be completed.', values: {} };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw { code: 'APP-DATA-INVALID', values: {} };
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw { code: 'APP-UNAVAILABLE', values: {} };
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', failAbort);
  }
}

export async function mutateForum(user: Pick<User, 'getIdToken'>, postId: string, mutation: unknown) {
  return communityRequest(user, `/api/forum/${encodeURIComponent(postId)}`, { requestId: crypto.randomUUID(), mutation }, 'PATCH');
}

/** Repeating DELETE resumes the same server-owned deletion, including partial cascades. */
export async function deleteForumPost(user: Pick<User, 'getIdToken'>, postId: string) {
  try { await communityRequest(user, `/api/forum/${encodeURIComponent(postId)}`, undefined, 'DELETE'); }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^(?:APP|AUTH|FORUM)-[A-Z0-9-]{1,60}$/.test(error.code) ? error.code : 'APP-REQUEST-FAILED';
    throw { code, message: 'Could not delete post. Retry to resume deletion.', values: {} };
  }
}
