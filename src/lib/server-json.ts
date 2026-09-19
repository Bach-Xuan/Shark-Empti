import 'server-only';
import { ApiError } from './server-api';

/** Bound bytes while consuming the stream, including chunked requests without a length. */
export async function readLimitedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const oversized = () => new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
  if (Number(request.headers.get('content-length')) > maximumBytes) throw oversized();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON body.');
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximumBytes) { await reader.cancel(); throw oversized(); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
