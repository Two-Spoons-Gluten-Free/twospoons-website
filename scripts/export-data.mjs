#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createStore } from '../src/lib/submissions.mjs';

const columns = {
  signup: ['id', 'submittedAt', 'name', 'email', 'consent', 'interests', 'source'],
  contact: ['id', 'submittedAt', 'name', 'email', 'consent', 'topic', 'message'],
  orders: ['reference', 'submittedAt', 'name', 'email', 'phone', 'consent', 'items', 'fulfillment', 'address', 'notes', 'newsletter'],
};
const usage = 'Usage: node scripts/export-data.mjs <signup|contact|orders> --format <csv|json> --out /private/path/export-file';

function csvCell(value) {
  let text = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Quoting CSV alone does not stop spreadsheet formulas from executing.
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

try {
  const [type, ...args] = process.argv.slice(2);
  if (!Object.hasOwn(columns, type) || args.length !== 4) throw new Error(usage);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--format', '--out'].includes(args[i]) || options[args[i]]) throw new Error(usage);
    options[args[i]] = args[i + 1];
  }
  if (!['csv', 'json'].includes(options['--format']) || !options['--out']) throw new Error(usage);
  const output = resolve(options['--out']);
  for (const webRoot of ['public', 'dist']) {
    const root = resolve(webRoot);
    if (output === root || output.startsWith(`${root}${sep}`)) throw new Error('Choose a private export path outside public/ and dist/.');
  }
  const dataDir = process.env.DATA_DIR || resolve('.data');
  if (!existsSync(join(dataDir, 'submissions.sqlite'))) throw new Error('No submissions database exists in DATA_DIR.');
  const store = createStore(dataDir);
  let rows;
  try { rows = store.list(type); }
  finally { store.close(); }
  const contents = options['--format'] === 'json'
    ? `${JSON.stringify(rows, null, 2)}\n`
    : `${[columns[type], ...rows.map((row) => columns[type].map((column) => row[column]))].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  writeFileSync(output, contents, { flag: 'wx', mode: 0o600 });
  console.log(`Exported ${rows.length} ${type} record(s) to ${output}`);
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'The export file already exists. Choose a new filename.' : error.message);
  process.exitCode = 1;
}
