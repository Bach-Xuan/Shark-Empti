import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/forum-client', () => ({ communityRequest: request }));
import { writeLearningRecord, saveHistoryFeedback } from '@/lib/learning-client';
const user = { getIdToken: vi.fn() }, id = '4e1db1eb-e496-4989-b671-462f375ba4f4';
beforeEach(() => { request.mockReset(); });
it('reuses an immutable payload and ID after response loss without serializing undefined fields', async () => {
  const data = { cards: [{ front: 'Original', back: 'Answer' }], omitted: undefined };
  request.mockImplementationOnce(() => { data.cards[0].front = 'Later edit'; throw new TypeError('Lost response'); }).mockResolvedValueOnce({ recordId: id });
  await writeLearningRecord(user, 'flashcards', id, data);
  expect(request).toHaveBeenCalledTimes(2);
  for (const call of request.mock.calls) {
    expect(call.slice(0, 4)).toEqual([user, `/api/learning/flashcards/${id}`, { cards: [{ front: 'Original', back: 'Answer' }] }, 'PUT']);
  }
});
it.each(['APP-INVALID-INPUT', 'APP-REQUEST-CONFLICT', 'APP-RATE-LIMITED', 'AUTH-INVALID'])('does not retry an explicit %s rejection', async code => {
  request.mockRejectedValue({ code });
  await expect(saveHistoryFeedback(user, id, {})).rejects.toMatchObject({ code });
  expect(request).toHaveBeenCalledOnce();
});
it('bounds retry exhaustion, ignores invalid acknowledgements and honors cancellation', async () => {
  request.mockRejectedValue({ code: 'APP-UNAVAILABLE' });
  await expect(writeLearningRecord(user, 'history', id, {})).rejects.toMatchObject({ code: 'APP-UNAVAILABLE' });
  expect(request).toHaveBeenCalledTimes(2);
  request.mockReset().mockResolvedValue({ recordId: 'another-record' });
  await expect(writeLearningRecord(user, 'history', id, {})).rejects.toMatchObject({ code: 'APP-DATA-INVALID' });
  expect(request).toHaveBeenCalledOnce();
  const controller = new AbortController(); controller.abort();
  request.mockReset().mockRejectedValue({ code: 'APP-UNAVAILABLE' });
  await expect(writeLearningRecord(user, 'history', id, {}, controller.signal)).rejects.toMatchObject({ code: 'APP-UNAVAILABLE' });
  expect(request).toHaveBeenCalledOnce();
});
