// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ severity: 'moderate', write: vi.fn(), policy: { version: 1, blockingSeverities: ['high', 'critical'] } }));
vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { default: { ...actual,
    readFileSync: (file: string, ...args: unknown[]) => file === 'package-lock.json' ? JSON.stringify({ packages: { 'node_modules/fixture': { version: '1.0.0' } } }) : file === 'config/dependency-audit-policy.json' ? JSON.stringify(mocks.policy) : Reflect.apply(actual.readFileSync, actual, [file, ...args]),
    mkdirSync: vi.fn(), writeFileSync: mocks.write,
  } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); process.exitCode = 0; mocks.policy.version = 1; mocks.write.mockClear(); });
it.each(['moderate', 'high', 'critical'])('reports %s findings and enforces the checked-in threshold', async severity => {
  mocks.severity = severity;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ fixture: [{ id: 123, severity, vulnerable_versions: '<2.0.0' }] }) }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await import('../scripts/dependency-audit.mjs');
  const report = JSON.parse(mocks.write.mock.calls[0][1]);
  expect(report.advisories[0].installed).toHaveLength(1);
  expect(report.blockingFindings).toBe(severity === 'moderate' ? 0 : 1);
  expect(process.exitCode || 0).toBe(severity === 'moderate' ? 0 : 1);
});
it('fails closed on registry errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(import('../scripts/dependency-audit.mjs')).rejects.toThrow('Registry audit HTTP 503');
  expect(mocks.write).not.toHaveBeenCalled();
});
