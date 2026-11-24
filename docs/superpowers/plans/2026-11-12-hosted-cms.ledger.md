# Hosted CMS Implementation Ledger

> 2026-11-12 — Superseded by `2026-11-12-local-admin.md` after the owner chose a local editor. Its Sanity/Cloudflare code was removed from this repository; the remote Sanity project was left untouched and is no longer connected to this site.

- 2026-11-12 — User approved Sanity Free, preset detail templates with sortable blocks, and a form plus pre-publish preview. Sanity project and public `production` dataset created; project remains on the $0 Growth Trial and is set to downgrade to Free, with no payment method or paid upgrade added.
- 2026-11-12 — Added the Sanity Studio schemas, local fallback content API, static published-data routes, rich-text/block renderers, image crop-aware URLs, and repeatable content migration script.
- 2026-11-12 — Added Cloudflare Workers draft preview routes using Sanity's preview URL validation and server-only token, plus Presentation Tool document routes. Public pages remain prerendered and Pages uploads only `dist/client/`.
- 2026-11-12 — Validation: Astro build produced 28 public pages; Studio build succeeded; migration dry-run planned 35 documents and 22 unique images; local Works page and preview-without-cookie 401 were inspected.
- 2026-11-12 — Follow-up: corrected Pages artifact instructions, added the first Research Log entry to migration data, hardened content links to internal paths/HTTPS, and made migration load the ignored root `.env` file.
- Historical state — These entries document the abandoned hosted-CMS approach and are not current operating instructions.
- Constraint — Do not push, deploy, create accounts, configure paid features, or add payment methods without an explicit request.
