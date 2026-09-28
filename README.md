# Two Spoons

<p align="center">
  <img src="public/images/Two%20Spoons.png" width="180" alt="Two Spoons logo" />
</p>

<p align="center">
  A warm, gluten-free family-kitchen website for Two Spoons in Haymarket, Virginia.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#scripts">Scripts</a> ·
  <a href="#project-map">Project map</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#quality-checks">Quality checks</a>
</p>

---

## About

Two Spoons is an Astro site for a father-and-daughter gluten-free food business. It introduces the brand, products in development, recipe ideas, order requests, community updates, and the care behind a family kitchen.

The site is built around five pantry products:

- Chocolate chip cookies
- Banana bread
- All-purpose seasoning
- Taco seasoning
- Cajun & blackening seasoning

It also includes recipe inspiration, a newsletter signup, contact form, and an order-request workflow. Form submissions are validated server-side and persisted locally in SQLite.

> **Food-business note:** Two Spoons operates under the Virginia Home Kitchen Food Processing Exemption, Va. Code § 3.2-5130. The site does not claim third-party gluten-free certification.

## Highlights

- Responsive Astro pages with a warm, brand-led visual system
- Product catalog shared across pantry, product detail, and order pages
- Gluten-free, cross-contact, ingredient, and exemption messaging
- Recipe ideas for seasoning blends and baking mixes
- Order requests with product-specific delivery frequencies
- Server-side validation, rate limiting, and SQLite-backed submissions
- Native Node test suite for submission handling and export behavior

## Quick Start

### Prerequisites

- Node.js 22.13 or newer
- npm

### Install and run

```sh
git clone https://github.com/Two-Spoons-Gluten-Free/twospoons-website.git
cd twospoons-website
npm install
cp .env.example .env
npm run dev
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Astro development server. |
| `npm run build` | Run Astro checks and create a production build in `dist/`. |
| `npm run start` | Run the built Node server. Run `npm run build` first. |
| `npm run preview` | Preview the production build locally. |
| `npm test` | Run submission and export tests. |

## Project Map

```text
src/
  components/    Shared Astro UI: header, footer, forms, cards, and icons
  data/          Product catalog and recipe/ingredient data
  layouts/       Shared site shell
  lib/           Submission validation, SQLite storage, and request handling
  pages/         Public pages and API endpoints
  styles/        Global responsive visual system
public/images/   Brand logo and illustrated product assets
scripts/         Data-export utility
tests/           Node native test suite
docs/            Product, design, and planning references
```

## Configuration

Copy `.env.example` to `.env` for local development:

```dotenv
PUBLIC_SITE_URL=http://localhost:4321
DATA_DIR=./.data
HOST=127.0.0.1
PORT=4321
```

`DATA_DIR` holds the local SQLite database of form submissions. It is intentionally ignored by Git. Use a persistent, access-controlled directory for this value in production.

## Content Updates

- Update the product lineup in `src/data/products.ts`.
- Update preparation and ingredient information in `src/data/recipes.ts`.
- Add recipe inspiration in `src/pages/recipes.astro`.
- Replace placeholder artwork in `public/images/` with owned product photography as it becomes available.

## Quality Checks

Before opening a pull request or deploying, run:

```sh
npm test
npm run build
```

The build includes Astro type and template checking. The test suite covers validation, persistence, request handling, rate limits, and exports.

## Deployment

The site is deployed as a static Astro build through GitHub Pages. Every push to `main` runs the deployment workflow in `.github/workflows/deploy-pages.yml`.

In the repository's GitHub settings, set **Pages** to use **GitHub Actions** as the build and deployment source. The published project URL is:

```text
https://two-spoons-gluten-free.github.io/twospoons-website/
```

GitHub Pages cannot run the SQLite-backed form endpoints in `src/lib/submissions.mjs`. The public Pages build keeps the form interfaces visible but tells visitors that online submissions are not available. Connect an external form provider or deploy the app to a Node host before enabling live submissions.

For a server-backed deployment, restore API routes that call `handleSubmission` and use a writable, persistent `DATA_DIR`:

```sh
npm ci
npm run build
```

## Contributing

Keep changes focused, accessible, and consistent with the family-kitchen voice. For any form or persistence change, add or update a focused test and run the quality checks above.

## License

This repository is private. All rights reserved unless Two Spoons publishes a separate license.