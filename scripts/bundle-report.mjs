import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const root = '.next/server/app';
const routes = [];
const measuredChunks = new Map();

// Shared chunks occur in many route manifests. Read and compress each once;
// retain the same compression settings and per-route measurement contract.
function measureEntry(file) {
  if (!measuredChunks.has(file)) {
    const buffer = fs.readFileSync(path.join('.next', file));
    measuredChunks.set(file, {
      file,
      decoded: buffer.length,
      gzip: gzipSync(buffer).length,
      brotli: brotliCompressSync(buffer).length,
    });
  }
  return measuredChunks.get(file);
}

const manifests = fs.readdirSync(root, { recursive: true })
  .filter(name => name.endsWith('client-reference-manifest.js'));
for (const name of manifests) {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
  for (const [route, manifest] of Object.entries(context.__RSC_MANIFEST)) {
    const files = [...new Set(Object.values(manifest.entryJSFiles).flat())];
    const chunks = files.map(measureEntry);
    routes.push({
      route,
      scope: 'union of entry JS including error boundaries; not measured First Load JS',
      decoded: chunks.reduce((sum, chunk) => sum + chunk.decoded, 0),
      gzip: chunks.reduce((sum, chunk) => sum + chunk.gzip, 0),
      clientReferences: Object.entries(manifest.clientModules)
        .filter(([module]) => module.includes('/src/'))
        .map(([module, reference]) => ({ module, chunks: reference.chunks })),
      chunks,
    });
  }
}

const knownEntries = new Set(routes.flatMap(route => route.chunks.map(chunk => chunk.file)));
const otherChunks = fs.readdirSync('.next/static/chunks')
  .filter(name => name.endsWith('.js') && !knownEntries.has(`static/chunks/${name}`))
  .map(name => {
    const data = fs.readFileSync(path.join('.next/static/chunks', name));
    return { file: name, decoded: data.length, gzip: gzipSync(data).length };
  });
const report = {
  otherChunksScope: 'emitted JS outside entry manifests; potential deferred chunks, not proof of runtime loading',
  otherChunks,
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  buildId: fs.readFileSync('.next/BUILD_ID', 'utf8'),
  routes,
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/bundle.json', JSON.stringify(report, null, 2));
console.log(routes.map(({ route, gzip }) => ({ route, gzip })));
