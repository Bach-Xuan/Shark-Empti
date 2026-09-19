import type { User } from 'firebase/auth';

/** Repeating DELETE resumes the same server-owned deletion, including partial cascades. */
export async function deleteForumPost(user: Pick<User, 'getIdToken'>, postId: string) {
  const response = await fetch(`/api/forum/${encodeURIComponent(postId)}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
      && /^(?:APP|AUTH|FORUM)-[A-Z0-9-]{1,60}$/.test(payload.code) ? payload.code : 'APP-REQUEST-FAILED';
    throw { code, message: 'Could not delete post. Retry to resume deletion.', values: {} };
  }
}
