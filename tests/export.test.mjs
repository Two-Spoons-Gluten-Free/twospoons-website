import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createStore, validateSubmission } from '../src/lib/submissions.mjs';

const script = resolve('scripts/export-data.mjs');
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'two-spoons-export-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataDir = join(dir, 'data');
  const store = createStore(dataDir);
  store.save('signup', validateSubmission('signup', { name: '=SUM(1,2)', email: 'owner@example.com', consent: true }));
  store.save('orders', validateSubmission('orders', { name: 'Morgan Baker', email: 'owner@example.com', consent: true,
    items: [{ product: 'taco-seasoning', quantity: 3, frequency: 'quarterly' }], fulfillment: 'pickup' }));
  store.close();
  return { dir, dataDir, run: (...args) => spawnSync(process.execPath, [script, ...args], { env: { ...process.env, DATA_DIR: dataDir }, encoding: 'utf8' }) };
}

test('JSON export writes durable order details into a private file', (t) => {
  const { dir, run } = setup(t);
  const output = join(dir, 'orders.json');
  const result = run('orders', '--format', 'json', '--out', output);
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(rows[0].items[0].label, 'Taco seasoning');
  assert.equal(rows[0].items[0].quantity, 3);
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.equal(result.stdout.includes('owner@example.com'), false);
});

test('CSV export neutralizes spreadsheet formulas and escapes embedded commas', (t) => {
  const { dir, run } = setup(t);
  const output = join(dir, 'signups.csv');
  const result = run('signup', '--format', 'csv', '--out', output);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(output, 'utf8').includes('"\'=SUM(1,2)"'));
  assert.equal(statSync(output).mode & 0o777, 0o600);
});

test('export requires an explicit output and refuses to overwrite an existing file', (t) => {
  const { dir, run } = setup(t);
  const output = join(dir, 'existing.csv');
  writeFileSync(output, 'preserve me');
  assert.notEqual(run('signup', '--format', 'csv', '--out', output).status, 0);
  assert.equal(readFileSync(output, 'utf8'), 'preserve me');
  assert.notEqual(run('signup', '--format', 'json').status, 0);
  assert.notEqual(run('unknown', '--out', join(dir, 'bad.json')).status, 0);
});
