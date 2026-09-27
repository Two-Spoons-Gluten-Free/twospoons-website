import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const implementation = await import('../src/lib/submissions.mjs').catch(() => ({}));
const { validateSubmission, createStore, handleSubmission, createRateLimiter } = implementation;
const identity = { name: 'Morgan Baker', email: 'Morgan@example.com', consent: true, website: '' };
const order = { ...identity, items: [{ product: 'banana-bread', quantity: 2, frequency: 'weekly' }], fulfillment: 'pickup' };
const temp = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'two-spoons-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('backend exposes validation, storage, request handling and rate limiting', () => {
  for (const name of ['validateSubmission', 'createStore', 'handleSubmission', 'createRateLimiter']) {
    assert.equal(typeof implementation[name], 'function', `${name} must be implemented`);
  }
});

test('normalizes newsletter identity and validates interests', () => {
  const result = validateSubmission('signup', { ...identity, name: ' Morgan Baker ', interests: ['banana-bread'] });
  assert.deepEqual(result, { name: 'Morgan Baker', email: 'morgan@example.com', consent: true, interests: ['banana-bread'] });
});

test('rejects absent consent, malformed identities and unsupported interests', () => {
  for (const patch of [{ consent: false }, { consent: 'true' }, { consent: undefined }, { name: 'A' },
    { email: 'bad-email' }, { email: 'a\n@example.com' }, { name: 'x'.repeat(101) }, { interests: ['unknown'] }]) {
    assert.throws(() => validateSubmission('signup', { ...identity, ...patch }), /./);
  }
  for (const value of [null, [], 'text']) assert.throws(() => validateSubmission('signup', value), /./);
});

test('contact requires a meaningful bounded message', () => {
  assert.equal(validateSubmission('contact', { ...identity, message: 'Do you have any market dates next month?' }).message,
    'Do you have any market dates next month?');
  for (const message of ['', 'Too short', 'x'.repeat(4001), 42]) {
    assert.throws(() => validateSubmission('contact', { ...identity, message }), /./);
  }
});

test('order derives labels on the server and never records client supplied prices', () => {
  const result = validateSubmission('orders', { ...order, total: 1, items: [{ product: 'banana-bread', quantity: 2, frequency: 'weekly', label: 'Fake', price: 1 }] });
  assert.deepEqual(result.items, [{ product: 'banana-bread', label: 'Banana bread', quantity: 2, frequency: 'weekly' }]);
  assert.equal('total' in result, false);
  assert.equal(result.newsletter, false);
});

test('orders reject unknown products, duplicate lines, invalid quantities and fulfillment', () => {
  const patches = [{ items: [] }, { items: [{ product: 'unknown', quantity: 1 }] },
    ...[0, 21, 1.5, '2'].map((quantity) => ({ items: [{ product: 'banana-bread', quantity, frequency: 'weekly' }] })),
    { items: [{ product: 'banana-bread', quantity: 1, frequency: 'weekly' }, { product: 'banana-bread', quantity: 1, frequency: 'weekly' }] },
    { items: [{ product: 'banana-bread', quantity: 1, frequency: 'daily' }] },
    { items: [{ product: 'banana-bread', quantity: 1, frequency: 'yearly' }] },
    { fulfillment: 'ship' }, { newsletter: 'yes' }, { notes: 'x'.repeat(2001) }];
  for (const patch of patches) assert.throws(() => validateSubmission('orders', { ...order, ...patch }), /./);
});

test('seasoning blends accept yearly delivery requests', () => {
  const result = validateSubmission('orders', { ...order, items: [{ product: 'taco-seasoning', quantity: 1, frequency: 'yearly' }] });
  assert.equal(result.items[0].frequency, 'yearly');
});

test('delivery requires a complete Virginia address', () => {
  const address = { line1: '123 Test Lane', city: 'Richmond', state: 'VA', postalCode: '23220' };
  assert.equal(validateSubmission('orders', { ...order, fulfillment: 'delivery', address }).address.state, 'VA');
  for (const broken of [undefined, {}, { ...address, state: 'NC' }, { ...address, postalCode: '123' }, { ...address, city: '' }]) {
    assert.throws(() => validateSubmission('orders', { ...order, fulfillment: 'delivery', address: broken }), /./);
  }
});

test('signup is durable and duplicate addresses receive the same success without additional records', (t) => {
  const dir = join(temp(t), 'private');
  let store = createStore(dir);
  const data = validateSubmission('signup', identity);
  const first = store.save('signup', data);
  const duplicate = store.save('signup', data);
  assert.deepEqual(first, duplicate);
  store.close();
  store = createStore(dir);
  t.after(() => store.close());
  assert.equal(store.list('signup').length, 1);
  assert.equal(store.list('signup')[0].email, 'morgan@example.com');
});

test('SQLite directory and database have private permissions', (t) => {
  const dir = join(temp(t), 'private');
  const store = createStore(dir);
  t.after(() => store.close());
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(join(dir, 'submissions.sqlite')).mode & 0o777, 0o600);
});

test('saved order includes random reference and validated contents without implicit newsletter signup', (t) => {
  const store = createStore(join(temp(t), 'private'));
  t.after(() => store.close());
  const response = store.save('orders', validateSubmission('orders', order));
  assert.match(response.reference, /^TS-[A-F0-9]{12}$/);
  const rows = store.list('orders');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reference, response.reference);
  assert.deepEqual(rows[0].items, [{ product: 'banana-bread', label: 'Banana bread', quantity: 2, frequency: 'weekly' }]);
  assert.equal(store.list('signup').length, 0);
});

test('explicit order newsletter consent is saved with the order', (t) => {
  const store = createStore(join(temp(t), 'private'));
  t.after(() => store.close());
  store.save('orders', validateSubmission('orders', { ...order, newsletter: true }));
  assert.equal(store.list('orders')[0].newsletter, true);
  assert.equal(store.list('signup').length, 1);
});

test('failed newsletter write rolls back the entire order', (t) => {
  const dir = join(temp(t), 'private');
  const store = createStore(dir);
  t.after(() => store.close());
  const raw = new DatabaseSync(join(dir, 'submissions.sqlite'));
  raw.exec("CREATE TRIGGER fail_signup BEFORE INSERT ON signup BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  raw.close();
  assert.throws(() => store.save('orders', validateSubmission('orders', { ...order, newsletter: true })), /test failure/);
  assert.equal(store.list('orders').length, 0);
  assert.equal(store.list('signup').length, 0);
});

test('contacts persist their message and topic', (t) => {
  const store = createStore(join(temp(t), 'private'));
  t.after(() => store.close());
  store.save('contact', validateSubmission('contact', { ...identity, topic: 'Market', message: 'When is your next farmers market appearance?' }));
  assert.equal(store.list('contact')[0].topic, 'Market');
  assert.equal(store.list('contact')[0].message, 'When is your next farmers market appearance?');
});

const request = (body, options = {}) => new Request('https://twospoons.example/api/signup', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://twospoons.example', ...options.headers },
  body: typeof body === 'string' ? body : JSON.stringify(body), ...options,
});
const context = (t) => ({ dataDir: join(temp(t), 'private'), clientAddress: '127.0.0.1', rateLimiter: createRateLimiter() });

test('request handler saves valid submission and returns JSON with no-store', async (t) => {
  const ctx = context(t);
  const response = await handleSubmission('signup', request(identity), ctx);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const store = createStore(ctx.dataDir);
  t.after(() => store.close());
  assert.equal(store.list('signup').length, 1);
});

test('handler rejects invalid JSON, non-JSON, absent consent, oversized body and foreign origin', async (t) => {
  const ctx = context(t);
  for (const [input, options, status] of [
    ['{broken', {}, 400], [{ ...identity, consent: false }, {}, 400],
    [identity, { headers: { 'content-type': 'text/plain', origin: 'https://twospoons.example' } }, 415],
    [identity, { headers: { 'content-type': 'application/json', origin: 'https://attacker.example' } }, 403],
    ['x'.repeat(16385), {}, 413],
  ]) {
    const response = await handleSubmission('signup', request(input, options), ctx);
    assert.equal(response.status, status);
    assert.equal((await response.json()).ok, false);
  }
});

test('honeypot produces normal success but persists nothing', async (t) => {
  const ctx = context(t);
  const response = await handleSubmission('signup', request({ ...identity, website: 'spam.example' }), ctx);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  const store = createStore(ctx.dataDir);
  t.after(() => store.close());
  assert.equal(store.list('signup').length, 0);
});

test('rate limiter throttles one address without blocking a different address and expires', () => {
  const limit = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limit('ip-a', 1), true);
  assert.equal(limit('ip-a', 2), true);
  assert.equal(limit('ip-a', 3), false);
  assert.equal(limit('ip-b', 3), true);
  assert.equal(limit('ip-a', 1002), true);
});

test('handler returns 429 after per-address limit and supplies retry-after', async (t) => {
  const ctx = { ...context(t), rateLimiter: createRateLimiter({ limit: 1 }) };
  await handleSubmission('signup', request(identity), ctx);
  const response = await handleSubmission('signup', request(identity), ctx);
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
});

test('storage failures do not report success or expose filesystem details', async (t) => {
  const ctx = context(t);
  writeFileSync(ctx.dataDir, 'this is a file');
  const response = await handleSubmission('signup', request(identity), { ...ctx, reportError: () => {} });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes(ctx.dataDir), false);
});
