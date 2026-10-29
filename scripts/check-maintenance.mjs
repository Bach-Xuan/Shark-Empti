import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import semver from 'semver';
import { ESLint } from 'eslint';
import { CLEANUP_TARGETS } from './clean.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const manifest = readJson('package.json');
const lock = readJson('package-lock.json');
const problems = [];
const declared = { ...manifest.dependencies, ...manifest.devDependencies };
const stable = value => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));

for (const field of ['dependencies', 'devDependencies', 'engines']) {
  if (stable(manifest[field]) !== stable(lock.packages[''][field])) problems.push(`Manifest/lock mismatch: ${field}`);
}
for (const [name, range] of Object.entries(declared)) {
  const installed = lock.packages[`node_modules/${name}`];
  if (!installed || !semver.satisfies(installed.version, range)) problems.push(`Missing or incompatible locked dependency: ${name}`);
}

const sources = ['src', 'scripts', 'tests'].flatMap(directory => fs.readdirSync(path.join(root, directory), { recursive: true })
  .filter(file => /\.(?:[cm]?ts|tsx|mjs|js)$/.test(file)).map(file => path.join(directory, file)));
sources.push(...fs.readdirSync(root).filter(file => /\.(?:[cm]?ts|mjs|js)$/.test(file)));
for (const file of sources) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const checkImport = specifier => {
    if (!ts.isStringLiteral(specifier)) return;
    const name = specifier.text;
    if (name.startsWith('.') || name.startsWith('@/') || isBuiltin(name)) return;
    const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
    if (!Object.hasOwn(declared, packageName)) problems.push(`Undeclared direct import ${packageName}: ${file}`);
  };
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) checkImport(node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.arguments.length && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) checkImport(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) problems.push('Cannot read tsconfig.json.');
else {
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  for (const error of parsed.errors) problems.push(`Invalid TypeScript configuration: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`);
  for (const file of parsed.fileNames) {
    if (/^(?:\.tools|reports|coverage|tmp|test-results|playwright-report|blob-report)[/\\]/.test(path.relative(root, file))) problems.push(`Generated file enters TypeScript program: ${file}`);
  }
}

const docs = ['README.md', ...fs.readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => `docs/${name}`)];
for (const file of docs) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of text.matchAll(/npm run ([\w:-]+)/g)) {
    if (!Object.hasOwn(manifest.scripts, match[1])) problems.push(`Unknown documented npm script ${match[1]}: ${file}`);
  }
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), decodeURIComponent(target)))) problems.push(`Missing local Markdown target ${target}: ${file}`);
  }
}

const directories = [...new Set([...Object.values(CLEANUP_TARGETS).flat(), 'reports', '.tools', 'tmp', 'out', 'build', 'dist', 'playwright/.cache', '.firebase', 'emulator-data'])];
const eslint = new ESLint({ cwd: root });
for (const directory of directories) {
  if (!await eslint.isPathIgnored(path.join(root, directory, 'maintenance-probe.js'))) problems.push(`Generated path is not excluded from ESLint: ${directory}`);
}
const probe = [...directories.map(name => `${name}/maintenance-probe`), 'firestore-debug.log', 'tsconfig.tsbuildinfo', '.env'];
const authorities = ['README.md', '.env.example', 'package-lock.json', 'tests/setup.ts', 'scripts/clean.mjs'];
const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: root, input: [...probe, ...authorities].join('\n'), encoding: 'utf8' });
if (result.error || ![0, 1].includes(result.status)) throw new Error('Cannot verify artifact ignore rules.');
const ignored = new Set(result.stdout.trim().split(/\r?\n/));
for (const file of probe) if (!ignored.has(file)) problems.push(`Generated/private path is not ignored: ${file}`);
for (const file of authorities) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`Missing maintenance authority: ${file}`);
  if (ignored.has(file)) problems.push(`Source/configuration is unexpectedly ignored: ${file}`);
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exitCode = 1;
} else console.log(`Maintenance contracts passed: ${sources.length} source/config files, ${docs.length} Markdown documents, declared imports, lockfile, TypeScript/ESLint scope and artifact ignores.`);
