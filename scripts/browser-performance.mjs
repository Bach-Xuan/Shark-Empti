import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const root = path.resolve(process.env.PERFORMANCE_ROOT || '.');
const label = process.env.PERFORMANCE_LABEL || 'current';
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Invalid performance label');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Run inside the demo Auth/Firestore Emulators');
const port = 9104, origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', OPENROUTER_API_KEY: '', AI_GENERATION_PROTOCOL_ENABLED: 'false', GCLOUD_PROJECT: 'demo-shark-empti', SHARK_EMULATOR_TEST_MODE: 'true' },
});
let exited = false; server.on('exit', () => { exited = true; }); server.stdout.resume(); server.stderr.resume();
let browser;
const rows = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (exited) throw new Error('Production server exited');
    try { if ((await fetch(origin + '/login')).ok) { ready = true; break; } } catch { /* await readiness */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Production server readiness timeout');
  browser = await chromium.launch({ headless: true });
  for (const route of ['/login', '/forum', '/arena']) {
    const samples = [];
    for (let repetition = 0; repetition < 5; repetition++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(() => { localStorage.setItem('shark_lang', 'en'); localStorage.setItem('shark_theme', 'light'); localStorage.setItem('shark_help_forum_seen', 'true'); });
      const page = await context.newPage();
      const client = await context.newCDPSession(page);
      await client.send('Performance.enable');
      for (const cache of ['cold', 'warm']) {
        await page.goto(origin + route, { waitUntil: 'load' });
        await (route === '/login' ? page.getByRole('button', { name: /Google/i }) : page.locator('main')).waitFor();
        // Same fixed settling interval for both revisions; not an assertion of network idle.
        await page.waitForTimeout(1000);
        const navigation = await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0];
          return { loadMs: n.loadEventEnd - n.startTime, domContentLoadedMs: n.domContentLoadedEventEnd - n.startTime, resources: performance.getEntriesByType('resource').map(r => ({ name: new URL(r.name).pathname, transferBytes: r.transferSize, decodedBytes: r.decodedBodySize, type: r.initiatorType })) };
        });
        const metrics = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        const counters = await client.send('Memory.getDOMCounters');
        let interactionMs = null;
        if (route === '/forum') {
          const search = page.locator('input').first();
          const start = performance.now(); await search.fill('comparison');
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          interactionMs = performance.now() - start;
          await search.fill('');
        }
        samples.push({ repetition, cache, ...navigation, heapBytes: metrics.JSHeapUsedSize, domNodes: counters.nodes, interactionMs });
      }
      await context.close();
    }
    rows.push({ route, samples });
  }
  const installedLock = path.resolve('node_modules/.package-lock.json');
  if (!fs.existsSync(installedLock)) throw new Error('Installed dependency lock is unavailable; run npm ci before measuring');
  const report = { measuredAt: new Date().toISOString(), label, root, buildId: fs.readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8').trim(), node: process.version, browser: browser.version(), platform: process.platform, cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length, installedDependencyLockSha256: crypto.createHash('sha256').update(fs.readFileSync(installedLock)).digest('hex'), conditions: 'Production server, guest session, empty demo data, Chromium 1280x800, 5 fresh contexts with cold then warm navigation, 1s settling, same installed dependency graph. Forum input-to-two-animation-frame timing includes automation overhead. No live AI or production billing claims.', rows };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(`reports/browser-performance-${label}.json`, JSON.stringify(report, null, 2));
  console.log(`Browser performance recorded for ${label}: ${rows.length} routes, 30 navigations.`);
} finally {
  await browser?.close();
  server.kill();
  if (!exited) await new Promise(resolve => server.once('exit', resolve));
}
