// @vitest-environment node
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';

const projectRequire = createRequire(`${process.cwd()}/package.json`);

it('loads the patched gRPC API used by the pinned Firebase client without replacing its SDK major', () => {
  const fromFirestore = createRequire(projectRequire.resolve('@firebase/firestore'));
  const grpc = fromFirestore('@grpc/grpc-js');
  expect(fromFirestore('@grpc/grpc-js/package.json').version).toBe('1.13.7');
  expect(typeof grpc.loadPackageDefinition).toBe('function');
  expect(typeof grpc.credentials.createInsecure).toBe('function');
});

it('keeps CLI CSV parsing and its ESM streaming JSON adapter working after the parent security update', async () => {
  const fromCli = createRequire(projectRequire.resolve('firebase-tools/package.json'));
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
