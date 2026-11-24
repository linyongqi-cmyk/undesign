# Hosted CMS Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Add a no-cost-within-free-quotas Sanity editing workflow for portfolio content, images, page sections, and protected pre-publication previews while keeping production on static GitHub Pages.

**Architecture:** Host Sanity Studio separately and store structured portfolio data and media in a Sanity Free project. Keep Astro static pages and existing local data as a safe fallback until CMS content is migrated; production builds read published Sanity documents. Use a protected Cloudflare Workers Free preview runtime for draft rendering, and a published-content webhook to trigger the existing GitHub Pages workflow.

**Tech Stack:** Astro 7, TypeScript, Sanity Studio and Content Lake, `@sanity/client`, Portable Text rendering, Cloudflare Workers/Pages Functions Free, GitHub Actions and GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-12-hosted-cms-design.md`

## Global Constraints

- The public site stays statically generated and deployed to GitHub Pages.
- Sanity remains on the Free plan; no paid add-ons, Growth upgrades, usage overages, or payment methods are configured.
- Preview hosting uses Cloudflare Free and a `workers.dev` URL; do not configure a paid plan or custom domain.
- If a free quota is reached, the affected preview, edit, or publish action must stop or wait for quota reset; do not upgrade automatically.
- CMS changes cover all current portfolio copy, images, research entries, home covers, About text in Japanese and Chinese, contact details, category labels, and page metadata.
- Editors may choose predefined templates and reorder supported blocks; creating template/block types and changing the visual design remain code changes.
- Draft content is served only by the protected preview runtime; production builds query published Sanity documents only.
- Keep `public/images/` and `src/data/portfolio.ts` until migrated content has been checked against all current routes.
- Do not push GitHub or deploy the public site as part of local implementation. Configure workflows and provide owner-run setup steps only.
- Do not add or run a test suite. Run `npm run build` and inspect the affected local pages as required by `WORKFLOW.md`.

## Review Focus

- **CMS configuration is absent:** local development/build still renders the current portfolio from local data. Verify `npm run build` with Sanity environment variables unset.
- **A work is missing its required slug/category/cover:** the CMS editor prevents publishing invalid records; inspect validation for each required field in Studio.
- **Rich text contains an unsupported block or unsafe URL:** the renderer shows supported blocks only and allows safe `https:` or internal links; inspect representative detail content locally.
- **A draft or CMS token reaches the public build:** public routes never read draft perspective or serialize the preview token; inspect generated HTML for draft-only text and secret values.
- **A preview URL is opened without the signed preview flow:** the preview page does not return draft content and sets no draft cookie.

---

## File Structure

- `studio/` — separate Sanity Studio package, document schemas, desk structure, and deployment configuration.
- `src/lib/cms/` — Sanity client, GROQ queries, content types, local fallback mapping, and image URL builder.
- `src/components/content/` — shared portfolio page renderers and the controlled Portable Text block renderer.
- `src/pages/` — existing public routes consume the content layer; draft-mode API/preview routes are served only by the preview runtime.
- `scripts/` — idempotent content and image migration from existing local sources to Sanity.
- `.github/workflows/deploy.yml` — build published CMS content and deploy static output on push or authenticated dispatch.
- `wrangler.jsonc` — free-tier preview runtime settings, without custom domain or paid bindings.
- `docs/` and `.env.example` — setup, free-plan limits, secrets, and account steps; never store live tokens.

## Task 1: Define Sanity Studio and Content Schemas

**Files:**
- Create: `studio/package.json`
- Create: `studio/sanity.config.ts`
- Create: `studio/sanity.cli.ts`
- Create: `studio/schemaTypes/index.ts`
- Create: `studio/schemaTypes/siteSettings.ts`
- Create: `studio/schemaTypes/category.ts`
- Create: `studio/schemaTypes/work.ts`
- Create: `studio/schemaTypes/researchEntry.ts`
- Create: `studio/schemaTypes/aboutProfile.ts`
- Create: `studio/schemaTypes/contactSettings.ts`
- Create: `studio/schemaTypes/objects/contentBlocks.ts`
- Create: `studio/schemaTypes/objects/portableText.ts`
- Modify: root `package.json` scripts and lockfile
- Create: `.env.example`

**Interfaces:** Schemas define document types `siteSettings`, `category`, `work`, `researchEntry`, `aboutProfile`, and `contactSettings`; block types are `richText`, `imageWithCaption`, `gallery`, `imageText`, and `quote`. Works expose a `template` enum (`standard`, `galleryLed`, `researchEssay`) plus ordered `sections`.

- [x] Add the Sanity Studio package using current stable package versions compatible with Node 22; configure the Studio to read project ID and dataset from environment variables.
- [x] Define singleton editing for site settings, profile, and contact details; define collections for categories, works, and research entries.
- [x] Add required-field, slug uniqueness, allowed-template, and non-empty gallery validation in schemas.
- [x] Define current About biography as Japanese and Chinese localized fields; leave other project text as authored.
- [x] Configure the Studio to use the free hosted Sanity Studio service and document that the Free role for the owner is Administrator.
- [x] Inspect Studio schemas and build the Astro site without configured Sanity variables; existing local content must still render.

## Task 2: Add the CMS Data and Rendering Layer

**Files:**
- Create: `src/lib/cms/client.ts`
- Create: `src/lib/cms/queries.ts`
- Create: `src/lib/cms/types.ts`
- Create: `src/lib/cms/content.ts`
- Create: `src/lib/cms/images.ts`
- Create: `src/components/content/PortableText.astro`
- Create: `src/components/content/ContentBlock.astro`
- Modify: root `package.json` and lockfile

**Interfaces:**
- `getSiteSettings(): Promise<SiteSettings>`
- `getCategories(): Promise<Category[]>`
- `getCategoryBySlug(slug: string): Promise<Category | undefined>`
- `getWorksByCategory(categorySlug: string): Promise<Work[]>`
- `getWork(categorySlug: string, workSlug: string, perspective?: 'published' | 'drafts'): Promise<Work | undefined>`
- `getResearchEntries(perspective?: 'published' | 'drafts'): Promise<ResearchEntry[]>`
- `getAboutProfile(): Promise<AboutProfile>`
- `getContactSettings(): Promise<ContactSettings>`
- Published queries use the Sanity CDN and never include drafts; draft queries require a server-only read token and use `useCdn: false`.

- [x] Add `@sanity/client`, `@sanity/image-url`, and `@portabletext/astro` at compatible versions.
- [x] Create a typed client that uses `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET`; only the server-side draft client may read `SANITY_API_READ_TOKEN`.
- [x] Implement GROQ queries for each document type, ordered by their CMS `order` field.
- [x] Implement the local fallback from existing `src/data/portfolio.ts` when CMS configuration is absent; do not change route data until this layer is ready.
- [x] Implement image URL generation using Sanity asset references, preserving explicit crop and hotspot values.
- [x] Render approved block types with Astro components; render alt text/captions, preserve Japanese/Chinese text, and reject unsafe link schemes.
- [x] Build with Sanity environment variables unset; remote dataset and generated-secret check await an owner project.

## Task 3: Move Existing Pages onto CMS-backed Content

**Files:**
- Create: `src/components/content/HomeContent.astro`
- Create: `src/components/content/CategoryContent.astro`
- Create: `src/components/content/WorkDetailContent.astro`
- Create: `src/components/content/AboutContent.astro`
- Create: `src/components/content/ContactContent.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/contact.astro`
- Modify: `src/pages/works/[category].astro`
- Modify: `src/pages/works/[category]/[slug].astro`
- Modify: `src/data/portfolio.ts` only after fallback consumers are removed

**Interfaces:** Public pages consume `src/lib/cms/content.ts`; page components receive typed records and render the existing layout/style. `getStaticPaths()` enumerates published category and work slugs at production build time.

- [x] Extract current page body markup into shared components without changing the visual layout or page routes.
- [x] Load homepage covers, crop/zoom settings, and rotation timing from site settings.
- [x] Load category listings and category order from Sanity; retain fixed route slugs as identifiers.
- [x] Load work cards, detail templates, galleries, and sections from Sanity.
- [x] Load Japanese/Chinese biography, profile facts, contact values, and page metadata from their CMS singletons.
- [x] Verify current public routes render from local fallback before a Sanity dataset exists.
- [x] Run `npm run build`; inspect the Works page locally.

## Task 4: Migrate Current Content and Images

**Files:**
- Create: `scripts/migrate-sanity-content.ts`
- Create: `scripts/migrate-sanity-assets.ts` or combine asset upload in the content migrator
- Modify: `package.json` with a `cms:migrate` script
- Source only: `src/data/portfolio.ts`, `public/images/home/`, `public/images/about/`, `public/images/works/`

**Interfaces:** `npm run cms:migrate -- --dry-run` reports planned documents/assets. `npm run cms:migrate` upserts stable Sanity IDs and uploads assets with an explicit `SANITY_WRITE_TOKEN`; it is repeatable and does not delete local files.

- [x] Map all current categories, work records, research entries, About/profile text, contacts, home covers, and page metadata to the schemas from Task 1.
- [x] Upload local image assets and replace file paths with Sanity asset references in migrated documents.
- [x] Keep crop/zoom/position values for each home cover and keep existing work-card order.
- [x] Add dry-run output and duplicate-safe upserts before the script writes remotely.
- [x] Document required environment variables and run steps; do not request or print the write token in chat or logs.
- [ ] After the owner provides a Sanity project/dataset and runs migration, compare imported document counts and image counts with current files before switching production builds to Sanity.

## Task 5: Add Protected Draft Preview

**Files:**
- Modify: `astro.config.mjs` to add `@astrojs/cloudflare` while preserving static output and prerendered public routes
- Modify: root `package.json` and lockfile with `@astrojs/cloudflare` and `@sanity/preview-url-secret`
- Create: `wrangler.jsonc`
- Create: `src/pages/api/draft-mode/enable.ts`
- Create: `src/pages/api/draft-mode/disable.ts`
- Create: `src/pages/preview/[...path].astro`
- Create: `src/components/content/PreviewPage.astro`
- Modify: `studio/sanity.config.ts` to add the Presentation tool preview URL and draft-mode enable path
- Modify: root `package.json` scripts for preview build/deploy
- Create: `public/.assetsignore` if required by the Cloudflare adapter

**Interfaces:** The preview enable endpoint validates Sanity's preview URL secret before setting a short-lived, HTTP-only, Secure, SameSite cookie. `src/pages/preview/[...path].astro` requires the cookie and server-only `SANITY_API_READ_TOKEN`, fetches Sanity draft perspective, and renders a read-only page using the shared content components.

- [x] Add a per-route Astro server-rendered preview entry while retaining pre-rendered public production pages.
- [x] Validate preview requests with Sanity's official preview URL secret flow; never pass the read token to the client.
- [x] Ensure the preview responds without draft content when the cookie/secret is absent, invalid, or expired.
- [x] Configure Cloudflare deployment to use a free `workers.dev` URL with no custom domain, paid plan, or paid storage binding.
- [x] Configure Sanity Presentation to open the preview page for home, About, categories, research entries, and works.
- [ ] Deploy only the preview runtime after the owner has created the free Cloudflare account and configured the required secrets; do not publish the public site.
- [ ] Verify the preview build under the Workers Free CPU/request limits; if a quota blocks preview, stop and keep the public site working without upgrading.

## Task 6: Connect Publish Events to GitHub Pages

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `docs/cms-setup.md`
- Modify: `README.md` and `WORKFLOW.md`

**Interfaces:** A published-document Sanity webhook sends an authenticated `workflow_dispatch` request to the existing `deploy.yml` workflow. Its credential is a fine-grained GitHub token with only Actions write permission, stored in the Sanity webhook configuration; production build uses published content only.

- [x] Configure the workflow to install, build against published Sanity data, and deploy to existing GitHub Pages on `push` and `workflow_dispatch`.
- [x] Stage only pre-rendered public files for the GitHub Pages artifact; keep Cloudflare Worker bundles and preview-only artifacts out of the Pages artifact.
- [ ] Preserve the current repository-derived `BASE_PATH` behavior and add build-failure diagnostics without echoing secrets.
- [x] Document exact Sanity webhook filter (published document create/update/delete only), GitHub API URL, required token permission, and secret storage.
- [ ] Document the current Sanity Free quotas (20 seats, 2 public datasets, 10k documents, 1M API CDN requests/month, 250k API requests/month, 100GB assets and bandwidth) and Cloudflare Workers Free limits (100k requests/day, 10ms CPU per invocation); note that limits can change and usage stops at hard caps.
- [ ] Document the rule not to upgrade plans, attach a payment method, configure paid add-ons, or buy a custom domain.
- [x] Run `npm run build` with fallback content; configured published-content build awaits the owner-created dataset.
- [ ] Leave the existing GitHub Pages deployment workflow untriggered from this local task; the owner enables the webhook after project setup.

## Task 7: Handoff and Content Cutover

**Files:**
- Modify: `docs/cms-setup.md`
- Modify: `README.md`, `WORKFLOW.md`, `.env.example`
- Remove only after verified: `src/data/portfolio.ts` and any image assets confirmed unused

- [x] Provide a setup checklist for the owner to create a Sanity Free project/dataset and hosted Studio. Cloudflare Free preview, secrets, and GitHub webhook activation remain future setup steps.
- [ ] Verify all current routes and images on a preview deployment before enabling CMS-backed production builds.
- [ ] Enable published-content builds only after CMS imports match the existing portfolio; retain a rollback path to local data until cutover succeeds.
- [ ] Confirm no paid-plan selection, billing card, or custom-domain purchase was introduced.
- [ ] Summarize completed pieces and clearly list any owner-only account setup still required.
