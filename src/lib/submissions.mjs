import { randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PRODUCTS = Object.freeze({
  'chocolate-chip-cookies': 'Chocolate chip cookies',
  'banana-bread': 'Banana bread',
  'all-purpose-seasoning': 'All-purpose seasoning',
  'taco-seasoning': 'Taco seasoning',
  'cajun-blackening-seasoning': 'Cajun & blackening seasoning',
});
const DELIVERY_FREQUENCIES = new Set(['weekly', 'biweekly', 'monthly', 'quarterly']);
const YEARLY_FREQUENCY_PRODUCTS = new Set(['all-purpose-seasoning', 'taco-seasoning', 'cajun-blackening-seasoning']);
const TYPES = ['signup', 'contact', 'orders'];
const MAX_BODY_BYTES = 16 * 1024;
const MESSAGES = {
  signup: 'Thank you! Your newsletter signup has been received.',
  contact: 'Thank you! Your message has been received.',
  orders: 'Your order request has been received. We will contact you to confirm availability, pricing, and fulfillment. No payment has been taken.',
};

class SubmissionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SubmissionError(`${label} is required.`);
  return value;
}

function field(value, label, min, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string') throw new SubmissionError(`Please enter ${label}.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) {
    throw new SubmissionError(`${label} must contain ${min}–${max} characters.`);
  }
  return clean;
}

/** Validate and pick only known fields; client labels, prices and totals are never trusted. */
export function validateSubmission(type, input) {
  if (!TYPES.includes(type)) throw new SubmissionError('Unknown form.');
  const data = object(input, 'Form data');
  const name = field(data.name, 'your name', 2, 100);
  const email = field(data.email, 'your email address', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SubmissionError('Please enter a valid email address.');
  if (data.consent !== true) throw new SubmissionError('Please check the consent box before submitting.');
  const base = { name, email, consent: true };
  if (type === 'signup') {
    const interests = data.interests ?? [];
    if (!Array.isArray(interests) || interests.length > 4 || interests.some((interest) => ![...Object.keys(PRODUCTS), 'events'].includes(interest))) {
      throw new SubmissionError('Please choose valid newsletter interests.');
    }
    return { ...base, interests: [...new Set(interests)] };
  }
  if (type === 'contact') return {
    ...base, topic: field(data.topic, 'a topic', 0, 100, true), message: field(data.message, 'your message', 20, 4000),
  };
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 5) throw new SubmissionError('Please choose one to five products.');
  const selected = new Set();
  const items = data.items.map((item) => {
    object(item, 'Product');
    if (typeof item.product !== 'string' || !Object.hasOwn(PRODUCTS, item.product) || selected.has(item.product)) {
      throw new SubmissionError('Please choose each available product only once.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new SubmissionError('Each quantity must be a whole number from 1 to 20.');
    if (typeof item.frequency !== 'string' || (!DELIVERY_FREQUENCIES.has(item.frequency) && !(item.frequency === 'yearly' && YEARLY_FREQUENCY_PRODUCTS.has(item.product)))) throw new SubmissionError('Please choose a valid delivery frequency for each product.');
    selected.add(item.product);
    return { product: item.product, label: PRODUCTS[item.product], quantity: item.quantity, frequency: item.frequency };
  });
  if (!['pickup', 'delivery'].includes(data.fulfillment)) throw new SubmissionError('Please choose pickup or delivery.');
  if (data.newsletter !== undefined && typeof data.newsletter !== 'boolean') throw new SubmissionError('Please choose whether to receive the newsletter.');
  let address = null;
  if (data.fulfillment === 'delivery') {
    const source = object(data.address, 'Delivery address');
    address = {
      line1: field(source.line1, 'a street address', 3, 200),
      line2: field(source.line2, 'an address line 2', 0, 200, true),
      city: field(source.city, 'a city', 2, 100),
      state: field(source.state, 'a state', 2, 2),
      postalCode: field(source.postalCode, 'a ZIP code', 5, 10),
    };
    if (address.state !== 'VA' || !/^\d{5}(?:-\d{4})?$/.test(address.postalCode)) {
      throw new SubmissionError('Delivery requests require a Virginia address and valid ZIP code.');
    }
  }
  return { ...base, items, fulfillment: data.fulfillment, address, phone: field(data.phone, 'a phone number', 0, 40, true),
    notes: field(data.notes, 'order notes', 0, 2000, true), newsletter: data.newsletter === true };
}

const reference = () => `TS-${randomBytes(6).toString('hex').toUpperCase()}`;
const success = (type, orderReference) => ({ ok: true, message: MESSAGES[type], ...(orderReference ? { reference: orderReference } : {}) });

/** Open a private local store. Use a persistent DATA_DIR on the server. */
export function createStore(dataDir = process.env.DATA_DIR || resolve('.data')) {
  const directory = resolve(dataDir);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!lstatSync(directory).isDirectory()) throw new Error('Data path must be a real directory.');
  chmodSync(directory, 0o700);
  const databasePath = join(directory, 'submissions.sqlite');
  try { closeSync(openSync(databasePath, 'wx', 0o600)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!lstatSync(databasePath).isFile()) throw new Error('Database path must be a regular file.');
  chmodSync(databasePath, 0o600);
  const db = new DatabaseSync(databasePath);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE;');
    for (const type of TYPES) db.exec(`CREATE TABLE IF NOT EXISTS ${type} (
      id TEXT PRIMARY KEY, submitted_at TEXT NOT NULL, email TEXT NOT NULL${type === 'signup' ? ' UNIQUE' : ''}, payload TEXT NOT NULL
    )`);
  } catch (error) { db.close(); throw error; }
  function insert(type, data, id = randomUUID()) {
    const clause = type === 'signup' ? ' ON CONFLICT(email) DO NOTHING' : '';
    db.prepare(`INSERT INTO ${type} (id, submitted_at, email, payload) VALUES (?, ?, ?, ?)${clause}`)
      .run(id, new Date().toISOString(), data.email, JSON.stringify(data));
  }
  return {
    save(type, data) {
      if (!TYPES.includes(type)) throw new Error('Unknown form type.');
      if (type !== 'orders') { insert(type, data); return success(type); }
      const orderReference = reference();
      db.exec('BEGIN IMMEDIATE');
      try {
        insert(type, { ...data, reference: orderReference }, orderReference);
        if (data.newsletter) insert('signup', { name: data.name, email: data.email, consent: true, interests: [], source: 'order' });
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return success(type, orderReference);
    },
    list(type) {
      if (!TYPES.includes(type)) throw new Error('Unknown form type.');
      return db.prepare(`SELECT id, submitted_at, payload FROM ${type} ORDER BY submitted_at, id`).all()
        .map((row) => ({ id: row.id, submittedAt: row.submitted_at, ...JSON.parse(row.payload) }));
    },
    close() { db.close(); },
  };
}

/** Process-local limit: deploy a shared limit at the proxy when running multiple workers. */
export function createRateLimiter({ limit = 10, windowMs = 60_000, maxKeys = 10_000 } = {}) {
  const entries = new Map();
  return (address, now = Date.now()) => {
    for (const [key, value] of entries) if (value.expires <= now) entries.delete(key);
    let current = entries.get(address);
    if (!current) {
      if (entries.size >= maxKeys) return false;
      current = { count: 0, expires: now + windowMs };
      entries.set(address, current);
    }
    current.count += 1;
    return current.count <= limit;
  };
}

const sharedRateLimiter = createRateLimiter();
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

async function readBody(request) {
  const announcedLength = Number(request.headers.get('content-length') || 0);
  if (announcedLength > MAX_BODY_BYTES) throw new SubmissionError('This form is too large. Please shorten your message.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SubmissionError('Please complete the form.');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new SubmissionError('This form is too large. Please shorten your message.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new SubmissionError('The form could not be read. Please try again.'); }
}

export async function handleSubmission(type, request, {
  clientAddress = 'unknown', dataDir, rateLimiter = sharedRateLimiter,
  reportError = (error) => console.error('Submission storage failed:', error.code || error.name),
} = {}) {
  if (request.method !== 'POST') return response({ ok: false, error: 'Please submit this form with POST.' }, 405, { allow: 'POST' });
  if (!rateLimiter(clientAddress)) return response({ ok: false, error: 'Too many requests. Please wait a minute and try again.' }, 429, { 'retry-after': '60' });
  try {
    const expectedOrigin = process.env.SITE_ORIGIN ? new URL(process.env.SITE_ORIGIN).origin : new URL(request.url).origin;
    if (request.headers.get('origin') !== expectedOrigin) throw new SubmissionError('Please submit this form from our website.', 403);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new SubmissionError('Please submit the form as JSON.', 415);
    }
    const input = object(await readBody(request), 'Form data');
    if (field(input.website, 'website', 0, 2000, true)) return response(success(type, type === 'orders' ? reference() : undefined));
    const data = validateSubmission(type, input);
    const store = createStore(dataDir);
    try { return response(store.save(type, data)); }
    finally { store.close(); }
  } catch (error) {
    if (error instanceof SubmissionError) return response({ ok: false, error: error.message }, error.status);
    reportError(error);
    return response({ ok: false, error: 'We could not save your submission. Please try again shortly.' }, 503);
  }
}
