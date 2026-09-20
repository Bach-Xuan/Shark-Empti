import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/server-api';
import type { AiProtocolResponse } from './protocol';

export async function boundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
  const reader = request.body?.getReader();
  if (!reader) return JSON.parse('');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function protocolJson(value: AiProtocolResponse) {
  const status = value.state === 'running' ? 202 : value.state === 'failed' ? 422 : value.state === 'cancelled' ? 409 : 200;
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function aiProtocolEnabled() {
  if (process.env.NODE_ENV !== 'production') return process.env.AI_GENERATION_PROTOCOL_ENABLED !== 'false';
  return process.env.AI_GENERATION_PROTOCOL_ENABLED === 'true';
}
