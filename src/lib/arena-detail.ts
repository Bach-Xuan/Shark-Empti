import { createAppError, type AppError, type ErrorValue } from '@/lib/app-error';
import type { Language } from '@/lib/types';

export const arenaDetailMessages = {
  en: { exam: 'The exam could not be loaded.', leaderboard: 'The leaderboard could not be loaded.', ranking: 'Only completed attempts with verified timing are ranked. Earlier attempts without verified timing are excluded.', guru: 'Ask Guru is available for review after you finish this Arena challenge.' },
  vi: { exam: 'Không thể tải bài thi.', leaderboard: 'Không thể tải bảng xếp hạng.', ranking: 'Chỉ xếp hạng các lượt đã hoàn thành có thời gian được xác thực. Các lượt cũ chưa có thời gian được xác thực không được xếp hạng.', guru: 'Bạn có thể hỏi Guru để ôn tập sau khi hoàn thành thử thách Arena này.' },
} satisfies Record<Language, Record<string, string>>;

/** Only public diagnostic fields cross into UI; raw server/SDK messages never do. */
export function arenaResponseError(payload: unknown, status: number): AppError {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const code = typeof data.code === 'string' && /^(?:APP|AUTH|ARENA)-[A-Z0-9-]{1,60}$/.test(data.code)
    ? data.code : status === 401 ? 'AUTH-REQUIRED' : status === 403 ? 'APP-PERMISSION-DENIED' : 'APP-REQUEST-FAILED';
  const values: Record<string, ErrorValue> = {};
  if (data.values && typeof data.values === 'object') {
    for (const [key, value] of Object.entries(data.values)) {
      if (!['httpStatus', 'providerCode', 'retryAfterSeconds', 'operation', 'attemptedModels', 'lastFailure'].includes(key)) continue;
      if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean') values[key] = value;
      else if (typeof value === 'string' && /^[a-zA-Z0-9_.:/ -]{0,120}$/.test(value) && !/(?:sk-|or-v1-|Bearer|https?:)/i.test(value)) values[key] = value;
    }
  }
  return createAppError(code, '', { ...values, httpStatus: status });
}

export function arenaSubscriptionError(error: unknown): AppError {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  const codes: Record<string, string> = {
    'permission-denied': 'APP-PERMISSION-DENIED', unauthenticated: 'AUTH-REQUIRED',
    unavailable: 'APP-UNAVAILABLE', 'deadline-exceeded': 'APP-TIMEOUT',
    'not-found': 'ARENA-NOT-FOUND',
  };
  return createAppError(typeof code === 'string' ? codes[code.replace(/^firestore\//, '')] ?? 'APP-REQUEST-FAILED' : 'APP-REQUEST-FAILED', '');
}
