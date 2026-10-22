const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const history = require('../fixtures/migration-history.json');
const routes = require('../fixtures/router-routes.json');
const { migrations } = require('../../src/database/migrations/index.ts');
const ts = require('typescript');

test('TypeScript reorganization preserves published migration names and SQL exactly', () => {
  for (const expected of history) {
    const migration = migrations.find((entry) => entry.version === expected.version);
    assert.ok(migration, `Missing published migration ${expected.version}`);
    assert.equal(migration.name, expected.name);
    assert.equal(
      createHash('sha256').update(migration.sql.replaceAll('\r\n', '\n')).digest('hex'),
      expected.sqlSha256,
      `Published migration ${expected.version} was rewritten`,
    );
  }
});

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(directory, entry.name)).map((name) => `${entry.name}/${name}`)
      : /\.tsx?$/.test(entry.name)
        ? [entry.name.replace(/\.tsx?$/, '')]
        : [],
  );
}

test('existing Router paths survive the migration and providers remain outside the route tree', () => {
  const actual = routeFiles(join(__dirname, '../../src/app'));
  for (const route of routes) assert.ok(actual.includes(route), `Missing existing route: ${route}`);
  assert.ok(!actual.some((route) => route.startsWith('providers/')));
  const layout = readFileSync(join(__dirname, '../../src/app/_layout.tsx'), 'utf8');
  assert.ok(layout.includes('AppProviders'));
});

test('app composition keeps storage, preferences, Vault, lock and reminders in their existing order', () => {
  const file = join(__dirname, '../../src/providers/AppProviders.tsx');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const component = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'AppProviders',
  );
  assert.ok(component);
  const names: string[] = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      names.push(node.tagName.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(component.body);
  assert.deepEqual(names, [
    'SafeAreaProvider',
    'DatabaseProvider',
    'SettingsProvider',
    'ConfiguredTheme',
    'ThemedStatusBar',
    'VaultProvider',
    'AppSecurityGate',
    'MedicineNotificationsProvider',
  ]);
});

test('native KDF callers retain platform-aware imports instead of forcing the host reference', () => {
  for (const name of ['vaultCrypto.native.ts', 'vaultCryptoGate.ts']) {
    const file = join(__dirname, '../../src/services/security', name);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const requests: string[] = [];
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === 'require' &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        requests.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(requests.includes('./vaultKdf'), `${name} bypasses Metro platform selection`);
    assert.ok(!requests.includes('./vaultKdf.ts'), `${name} forces the Node-only reference`);
  }
});
