import fs from 'node:fs';
import crypto from 'node:crypto';
import semver from 'semver';
const lockText = fs.readFileSync('package-lock.json', 'utf8'), lock = JSON.parse(lockText);
const packages = Object.create(null), paths = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
 if (!path || !pkg.version) continue;
 const name = pkg.name || path.split('node_modules/').at(-1);
 (packages[name] ??= new Set()).add(pkg.version); paths.push({ name, path, version: pkg.version, dev: !!pkg.dev });
}
const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(Object.entries(packages).map(([name, versions]) => [name, [...versions]]))), signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error('Registry audit HTTP ' + response.status);
const advisories = await response.json();
const findings = Object.entries(advisories).flatMap(([name, entries]) => entries.map(advisory => ({ ...advisory, installed: paths.filter(pkg => pkg.name === name && semver.satisfies(pkg.version, advisory.vulnerable_versions)) }))).filter(item => item.installed.length);
const report = { measuredAt: new Date().toISOString(), lockSha256: crypto.createHash('sha256').update(lockText).digest('hex'), endpoint: 'npm bulk advisory', packageInstances: paths.length, advisories: findings };
fs.mkdirSync('reports', { recursive: true }); fs.writeFileSync('reports/dependency-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ measuredAt: report.measuredAt, instances: paths.length, advisories: findings.length, bySeverity: Object.fromEntries(['low','moderate','high','critical'].map(level => [level, findings.filter(item => item.severity === level).length])) }));
