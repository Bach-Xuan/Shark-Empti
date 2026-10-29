import 'server-only';
import { AI_IO_LIMITS } from './config/limits';

export class ProviderBodyLimitError extends Error {}

/** The provider deadline also covers a body that stalls after successful headers. */
export async function readProviderBody(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  const consume = async () => {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > AI_IO_LIMITS.providerBodyBytes) throw new ProviderBodyLimitError();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AI_IO_LIMITS.providerBodyBytes) throw new ProviderBodyLimitError();
      chunks.push(value);
    }
  };
  try {
    await Promise.race([consume(), cancelled]);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
