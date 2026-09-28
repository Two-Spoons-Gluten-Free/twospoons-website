const SHEETS = Object.freeze({
  signup: {
    name: 'Newsletter',
    headers: ['Submitted at', 'Name', 'Email', 'Interests'],
    fields: ['submittedAt', 'name', 'email', 'interests'],
  },
  contact: {
    name: 'Messages',
    headers: ['Submitted at', 'Name', 'Email', 'Topic', 'Message'],
    fields: ['submittedAt', 'name', 'email', 'topic', 'message'],
  },
  orders: {
    name: 'Order Requests',
    headers: ['Submitted at', 'Name', 'Email', 'Phone', 'Fulfillment', 'Address', 'Items', 'Notes', 'Newsletter opt-in'],
    fields: ['submittedAt', 'name', 'email', 'phone', 'fulfillment', 'address', 'items', 'notes', 'newsletter'],
  },
});

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    const record = validatePayload_(payload);
    appendRecord_(record);
    return response_({ ok: true });
  } catch (error) {
    console.error(error);
    return response_({ ok: false, error: 'Unable to save this submission.' });
  }
}

function doGet() {
  return response_({ ok: true, service: 'Two Spoons form submissions' });
}

function parsePayload_(event) {
  if (!event || !event.postData || typeof event.postData.contents !== 'string') throw new Error('Missing request body.');
  const payload = JSON.parse(event.postData.contents);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid request body.');
  return payload;
}

function validatePayload_(payload) {
  const kind = payload.kind;
  if (!Object.prototype.hasOwnProperty.call(SHEETS, kind)) throw new Error('Unknown submission type.');
  if (payload.website) return { kind: kind, spam: true };

  const name = text_(payload.name, 2, 100, 'name');
  const email = text_(payload.email, 3, 254, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (payload.consent !== true) throw new Error('Consent is required.');

  const record = { kind: kind, submittedAt: new Date(), name: name, email: email };
  if (kind === 'signup') {
    const interests = Array.isArray(payload.interests) ? payload.interests.filter((item) => typeof item === 'string').slice(0, 6) : [];
    return { ...record, interests: interests.join(', ') };
  }
  if (kind === 'contact') {
    return { ...record, topic: optionalText_(payload.topic, 100), message: text_(payload.message, 20, 4000, 'message') };
  }

  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 5) throw new Error('Choose one to five items.');
  const items = payload.items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid order item.');
    const product = text_(item.product, 1, 100, 'product');
    const quantity = Number(item.quantity);
    const frequency = text_(item.frequency, 1, 30, 'frequency');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Invalid quantity.');
    return product + ' x' + quantity + ' (' + frequency + ')';
  });
  const fulfillment = text_(payload.fulfillment, 1, 30, 'fulfillment');
  let address = '';
  if (fulfillment === 'delivery') {
    const source = payload.address;
    if (!source || typeof source !== 'object') throw new Error('Delivery address is required.');
    address = [optionalText_(source.line1, 200), optionalText_(source.line2, 200), optionalText_(source.city, 100), optionalText_(source.state, 20), optionalText_(source.postalCode, 20)].filter(Boolean).join(', ');
  }
  return {
    ...record,
    phone: optionalText_(payload.phone, 40),
    fulfillment: fulfillment,
    address: address,
    items: items.join('; '),
    notes: optionalText_(payload.notes, 2000),
    newsletter: payload.newsletter === true ? 'Yes' : 'No',
  };
}

function appendRecord_(record) {
  if (record.spam) return;
  const definition = SHEETS[record.kind];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(definition.name);
      sheet.appendRow(definition.headers);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(definition.fields.map((field) => record[field] || ''));
  } finally {
    lock.releaseLock();
  }
}

function text_(value, min, max, field) {
  if (typeof value !== 'string') throw new Error('Invalid ' + field + '.');
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max || /[\u0000-\u001F\u007F]/.test(cleaned)) throw new Error('Invalid ' + field + '.');
  return cleaned;
}

function optionalText_(value, max) {
  if (value === undefined || value === null || value === '') return '';
  return text_(value, 0, max, 'field');
}

function response_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
