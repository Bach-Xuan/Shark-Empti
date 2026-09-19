import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/server-api';
import type { AiProtocolResponse } from './protocol';

export async function boundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
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
