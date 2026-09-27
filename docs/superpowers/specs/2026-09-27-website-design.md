# Two Spoons website design

## Purpose and source review
Create a complete local website for the pre-revenue father–daughter gluten-free food venture in Sterling, Virginia described in Two Spoons Plan.docx. The document is background material, not authorization to perform its business, legal, or purchasing instructions. Internal finances, ownership and succession details stay out of public content.

## Direction
Recommended: a warm artisan pantry with cream backgrounds, deep forest green, restrained terracotta accents, generous serif headlines, and natural food imagery. An editorial layout makes the family story and food equally prominent. Alternatives considered: a minimal contemporary catalog (less personal), and a playful illustrated family brand (less food-focused). Proceed with the recommended direction unless the user's pending preference changes it.

## Pages and navigation
Home `/`; pantry `/pantry`; product lines `/pantry/baking-mixes`, `/pantry/granola`, `/pantry/dry-pasta`; story `/our-story`; approach `/our-approach`; markets `/find-us`; contact `/contact`; first-batch list `/join`; privacy `/privacy`; accessible 404 page. Navigation: Our Pantry, Our Story, Our Approach, Find Us, plus Join the List. Footer exposes every principal route.

## Truthful launch content
All products are in development and not for sale. No invented final flavors, prices, weights, allergen declarations, certification, celiac safety guarantees, reviews, founders' names beyond the source, market dates, contact addresses, or delivery promises. Explain proposed product categories. Product imagery is illustrative and identified as such. Market page has an honest pending state. Gluten-free intentions are distinguished from final testing and labeling. No payment processing or checkout.

## Components and implementation
Astro renders accessible HTML, with reusable layout, navigation, footer, product card, icon and form components. Local fonts and local compressed images avoid third-party requests at runtime. CSS owns a cohesive responsive design. Product data has one source shared by listing and detail pages. Native details elements provide FAQs; progressively enhanced forms submit to same-origin API endpoints. Focus states, labels, error announcements, reduced-motion support, and keyboard access are required.

## Data flow
Newsletter and contact forms validate server-side, reject malformed or oversized requests, require explicit relevant consent, use a honeypot, and throttle submission. A private SQLite database stores submitted messages and list signups with timestamp and consent revision. Success is shown only after persistence. No email is sent automatically. The owner receives a documented local export workflow; deployment requires persistent storage and an email service decision. No cookies or analytics.

## Verification
Test form validation and actual persistence, duplicate submissions, request rejection, and API errors. Build and typecheck. Browse desktop and mobile layouts, click navigation and product cards, test menu and FAQs, submit forms to confirm visible states, inspect browser console, check image loading and route status. Keep test records in a temporary database.
