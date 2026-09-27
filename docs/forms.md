# Forms and owner access

Newsletter signups, contact messages, and order requests are saved on the server in SQLite. The application sends no emails and does not charge customers. Orders are requests: the owner must confirm products, prices, availability, and pickup or delivery arrangements directly with the customer.

## Run and host

Use Node 22.13 or later; this project uses Node's built-in `node:sqlite`. Node 22 may print an experimental SQLite warning. Run `npm install`, `npm run build`, and `npm start` from the project root. `npm run dev` starts local development.

The deployed application needs a running Node server and a persistent writable disk. Static-only hosting and ephemeral serverless filesystems do not preserve these submissions. Run one application instance with its own persistent local disk; SQLite on a shared network filesystem is not the intended deployment.

Set `DATA_DIR` to a dedicated absolute directory on that persistent disk, for example `/var/lib/twospoons`. The default is `.data` relative to the process working directory. The application creates `submissions.sqlite`, restricts the directory to owner access (`0700`), and restricts the database to owner read/write (`0600`). Keep this directory outside `public/`, `dist/`, source control, and any web-server static mount. `.data/` is gitignored.

Set `SITE_ORIGIN` to the exact public origin in production (scheme plus hostname and optional port, without a path), for example `https://your-confirmed-domain.example`. It is optional locally, where the request URL supplies the origin. All submissions require an `Origin` header matching this value. Configure the host and HTTPS reverse proxy so the public origin and Astro's URL agree.

The rate limit is 10 submissions per minute per `clientAddress`, shared across the three forms within one Node process. The server does not trust arbitrary forwarded IP headers. Behind a reverse proxy, configure Astro/your adapter and proxy to provide a trustworthy client address; otherwise all visitors may share the proxy address and its limit. Put a shared rate limit at your trusted proxy for multiple workers/instances. Restarting the process resets this local limit. The forms also reject oversized request bodies (16 KiB), invalid data, missing consent, non-JSON content, and other origins. A filled hidden `website` field returns a normal success without saving data.

## Retrieve submissions

There is no public admin route. Use authenticated shell access to the server and the owner export command. The output directory must already exist. Pick a private path and a new filename for every export; exports are created with mode `0600` and existing files are never overwritten.

```sh
DATA_DIR=/var/lib/twospoons node scripts/export-data.mjs signup --format csv --out /var/lib/twospoons/signups-2026-09-27.csv
DATA_DIR=/var/lib/twospoons node scripts/export-data.mjs contact --format json --out /var/lib/twospoons/messages-2026-09-27.json
DATA_DIR=/var/lib/twospoons node scripts/export-data.mjs orders --format csv --out /var/lib/twospoons/orders-2026-09-27.csv
```

CSV quotes every field and prefixes values that could run as spreadsheet formulas with an apostrophe. Nested order items and addresses are JSON within CSV cells. JSON exports preserve the full structure. The script prints only the record count and filename; it does not print customer details. Store exported customer data privately and review submissions regularly because no notification email is sent.

Back up the SQLite database using a SQLite-aware backup tool, or stop the server before copying the database. Keep backups private. Test restore procedures and decide a retention period before collecting real customer information. Newsletter entries are consent records for owner retrieval; connect a mailing provider and its unsubscribe handling before sending a newsletter. Duplicate newsletter submissions return the same success response and preserve the original entry.

## Payloads

All three endpoints accept `POST` with `Content-Type: application/json` and same-origin `Origin`. Each requires `name` (2–100 characters), `email` (valid address, at most 254 characters), and `consent: true`; `website` is an optional empty honeypot field. Email is normalized to lowercase. Only known fields are stored. Successful responses contain `{ "ok": true, "message": "…" }`; orders also contain a random `reference`, such as `TS-A120D935BC40`. Failures contain `{ "ok": false, "error": "…" }` with a suitable HTTP status.

- `/api/signup`: optional `interests` array, up to four entries from `baking-mixes`, `granola`, `dry-pasta`, `events`. Consent means newsletter enrollment.
- `/api/contact`: `message` (20–4000 characters), optional `topic` (at most 100). Consent covers handling the inquiry. Contact messages do not enroll the customer in the newsletter.
- `/api/orders`: `items`, with one to three distinct `{ "product": "granola", "quantity": 2 }` entries. Products are `baking-mixes`, `granola`, and `dry-pasta`; each quantity is an integer from 1 to 20. The server sets product labels and ignores client prices or totals. `fulfillment` is `pickup` or `delivery`; `notes` (at most 2000) and `phone` (at most 40) are optional. Consent covers processing the order request. Newsletter enrollment happens only when the separate, optional `newsletter` boolean is explicitly `true`; it is saved atomically with the order.

For delivery, `address` requires `line1` (3–200), `city` (2–100), `state: "VA"`, and `postalCode` (five digits or ZIP+4). `line2` is optional (at most 200). A valid Virginia address is a request for delivery, not a promise of service to that ZIP code.

Tests run with `npm test`. They cover validation, consent, stored records, duplicate signups, order transaction rollback, request safeguards, rate limits, file permissions, storage failures, and private exports.
