// @vitest-environment node
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';

const projectRequire = createRequire(`${process.cwd()}/package.json`);
const fromCli = createRequire(projectRequire.resolve('firebase-tools/package.json'));
const { PubSub } = fromCli('@google-cloud/pubsub');

it('loads the patched gRPC API used by the pinned Firebase client without replacing its SDK major', () => {
  const fromFirestore = createRequire(projectRequire.resolve('@firebase/firestore'));
  const grpc = fromFirestore('@grpc/grpc-js');
  expect(fromFirestore('@grpc/grpc-js/package.json').version).toBe('1.13.7');
  expect(typeof grpc.loadPackageDefinition).toBe('function');
  expect(typeof grpc.credentials.createInsecure).toBe('function');
});

it('keeps CLI CSV parsing and its ESM streaming JSON adapter working after the parent security update', async () => {
  const { parse } = fromCli('csv-parse');
  const records = [];
  for await (const record of Readable.from(['fixture,"a,b",true\r\n']).pipe(parse())) records.push(record);
  expect(records).toEqual([['fixture', 'a,b', 'true']]);

  const { loadStreamJson } = fromCli('./lib/streamJson');
  const { chain, parser, streamObject } = await loadStreamJson();
  const entries = [];
  for await (const entry of chain([Readable.from(['{"child":{"value":7},"other":[true,false]}']), parser(), streamObject()])) entries.push(entry);
  expect(entries).toEqual([{ key: 'child', value: { value: 7 } }, { key: 'other', value: [true, false] }]);
});

it('keeps the Firebase CLI file finder and ignore patterns compatible', () => {
  const { listFiles } = fromCli('./lib/listFiles');
  const files = listFiles('config', ['bundle-*.json']);
  expect(listFiles('config')).toContain('bundle-budgets.json');
  expect(files).toContain('dependency-audit-policy.json');
  expect(files).not.toContain('bundle-budgets.json');
});

it('builds Pub/Sub resource names through the Firebase CLI dependency', async () => {
  const client = new PubSub({ projectId: 'demo-shark-empti' });
  try {
    expect(client.topic('events').subscription('worker').name).toBe('projects/demo-shark-empti/subscriptions/worker');
  } finally {
    await client.close();
  }
});

it('preserves the legacy gaxios multipart boundary and TypeScript parser glob semantics', async () => {
  const { Gaxios } = projectRequire('gaxios');
  const response = await new Gaxios().request({ url: 'https://fixture.invalid/', method: 'POST',
    multipart: [{ headers: { 'Content-Type': 'text/plain' }, content: 'fixture part' }],
    adapter: async (options: { body: Readable; headers: Record<string, string> }) => {
      const chunks = [];
      for await (const chunk of options.body) chunks.push(Buffer.from(chunk));
      const boundary = options.headers['Content-Type'].split('boundary=')[1];
      expect(boundary).toMatch(/^[a-f0-9-]{36}$/);
      const body = Buffer.concat(chunks).toString();
      expect(body).toContain('fixture part');
      expect(body).toContain('--' + boundary);
      return { status: 200, data: 'accepted' };
    } });
  expect(response.data).toBe('accepted');
  const fromParser = createRequire(projectRequire.resolve('@typescript-eslint/typescript-estree'));
  const { minimatch } = fromParser('minimatch');
  expect(minimatch('.fixtures/config.ts', '**/*.ts', { dot: true })).toBe(true);
  expect(minimatch('.fixtures/config.js', '**/*.ts', { dot: true })).toBe(false);
});
