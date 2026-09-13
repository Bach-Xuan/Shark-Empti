// @vitest-environment node
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect,it } from 'vitest';

// Brand/version, native language names and technical identifiers are intentional.
const exceptions = new Set(['SHARK EMPTI', 'SHARK EMPTI v1.15.1', 'v1.15.1', 'SHARK COINS', 'English', 'Tiếng Việt', 'UID:']);
const visibleAttributes = new Set(['title', 'placeholder', 'aria-label', 'alt']);
function* sourceFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (path.endsWith('.tsx')) yield path;
  }
}

it('keeps static JSX copy and accessibility labels in catalogs, except explicit identifiers', () => {
  const violations: string[] = [];
  for (const path of sourceFiles('src')) {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const check = (node: ts.Node, text: string) => {
      const normalized = text.trim().replace(/\s+/g, ' ');
      if (/\p{L}/u.test(normalized) && !exceptions.has(normalized)) {
        violations.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${normalized}`);
      }
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) check(node, node.text);
      if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        check(node, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
});
