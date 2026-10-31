import 'server-only';
import { ApiError } from './server-api';

export const BODY_READ_TIMEOUT_MS = 10_000;

export async function readLimitedBytes(request: Request, maximumBytes: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let abort = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, reject) => {
    abort = () => reject(new ApiError('APP-REQUEST-CANCELLED', 408, 'The request was cancelled.'));
    request.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new ApiError('APP-BODY-TIMEOUT', 408, 'Request data was not received in time.')), BODY_READ_TIMEOUT_MS);
    if (request.signal.aborted) abort();
  });
  const consume = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
      }
      chunks.push(value);
    }
  };
  try {
    await Promise.race([consume(), budget]);
  } catch (error) {
    // Cancellation is best-effort: an uncooperative stream must not hold the
    // response after its byte/time budget has already been exceeded.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}


export async function readLimitedJson(request: Request, maximumBytes: number): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await readLimitedBytes(request, maximumBytes)));
}
