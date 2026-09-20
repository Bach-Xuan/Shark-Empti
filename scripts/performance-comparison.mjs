import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const baseline = process.env.PERFORMANCE_BASELINE_ROOT;
if (!baseline || !fs.existsSync(path.join(baseline, '.next/BUILD_ID'))) throw new Error('PERFORMANCE_BASELINE_ROOT must identify an already-built historical checkout using the same dependency graph and demo build variables.');
async function measure(label, root) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/browser-performance.mjs'], { windowsHide: true, stdio: 'inherit', env: { ...process.env, PERFORMANCE_LABEL: label, PERFORMANCE_ROOT: root } });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${label} measurement failed (${code})`)));
  });
  return JSON.parse(fs.readFileSync(`reports/browser-performance-${label}.json`, 'utf8'));
}
const before = await measure('baseline', baseline);
const after = await measure('current', process.cwd());
for (const field of ['browser', 'node', 'platform', 'cpu', 'installedDependencyLockSha256']) if (before[field] !== after[field]) throw new Error(`Incomparable ${field}`);
const percentile = (values, q) => { const sorted = values.toSorted((a, b) => a - b); return sorted[Math.ceil(sorted.length * q) - 1]; };
const rows = [];
for (const current of after.rows) for (const cache of ['cold', 'warm']) {
  const old = before.rows.find(row => row.route === current.route);
  if (!old) throw new Error(`Baseline route is missing: ${current.route}`);
  const summarize = row => {
    const samples = row.samples.filter(sample => sample.cache === cache);
    if (samples.length !== 5) throw new Error(`Expected five ${cache} samples for ${row.route}`);
    const metrics = {};
    for (const key of ['loadMs', 'domContentLoadedMs', 'heapBytes', 'domNodes', 'interactionMs']) {
      const values = samples.map(s => s[key]).filter(Number.isFinite);
      if (values.length) metrics[key] = { p50: percentile(values, 0.5), p95: percentile(values, 0.95), samples: values.length };
    }
    metrics.scriptDecodedBytes = { p50: percentile(samples.map(s => s.resources.filter(r => r.type === 'script').reduce((sum, r) => sum + r.decodedBytes, 0)), 0.5) };
    return metrics;
  };
  rows.push({ route: current.route, cache, baseline: summarize(old), current: summarize(current) });
}
if (before.rows.length !== after.rows.length) throw new Error('Baseline and current route inventories differ');
const report = { measuredAt: new Date().toISOString(), baselineBuild: before.buildId, currentBuild: after.buildId, conditions: after.conditions, interpretation: 'Sequential source comparison using one installed dependency graph; cache order is controlled but machine noise remains. Five samples per cell support exploratory distributions, not statistical significance or universal speedup. Authenticated learning flows, device camera and real provider latency are outside this measurement.', rows };
fs.writeFileSync('reports/performance-comparison.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(rows.map(r => ({ route: r.route, cache: r.cache, baselineLoadP50: r.baseline.loadMs.p50, currentLoadP50: r.current.loadMs.p50 })), null, 2));
