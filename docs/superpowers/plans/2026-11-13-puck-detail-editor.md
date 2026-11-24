# Puck Detail Editor Implementation Plan

> **For agentic workers:** The user approved Puck for one-work proof of concept, then requested that the same editing system be extended to every work entry.

**Goal:** Use Puck for every work entry in the local admin while keeping the existing JSON content model, save flow, and public page templates.

**Architecture:** Mount Puck for every selected work in the existing local admin. Convert its document state to and from the existing `Work` shape; Puck state is transient and is never written as the content source. Public pages keep their selected Astro templates; Research Log entries use a row-style preview because they are not standalone public detail routes.

**Tech Stack:** Astro, `@astrojs/react`, React, Puck, current local-admin API.

**Spec:** This plan and the user's requests to use Puck, approve the one-work proof of concept, and then extend it to the remaining works.

## Global Constraints

- Work content remains in the existing JSON files under `src/data/content/works/`.
- Keep saving through the current local admin API and save button.
- Keep Puck runtime limited to the local admin route; public output stays static.
- Do not change existing work content or templates as part of the editor migration; do not publish or push.
- Follow `AGENTS.md`: run `npm run build` and inspect the local page; do not add or run tests unless asked.

## Review Focus

- Existing work metadata, gallery images, and body blocks round-trip between Work JSON and Puck data.
- Missing optional fields and empty galleries render safely.
- Image selections remain valid local paths in the category image folder.
- Switching to another work preserves the unsaved Puck draft in the normal admin state.
- Puck is available across product, installation, visual, photography, and research entries.
- Public detail rendering remains static and uses each work's existing template unless the user changes it in the editor.

---

### Task 1: Load Puck in Astro admin

**Files:** `astro.config.mjs`, `src/components/admin/PuckWorkEditor.jsx`, `scripts/local-admin/app.js`, `scripts/local-admin/styles.css`

- [x] Add Astro React integration and a React-mounted Puck work editor.
- [x] Extend the Puck editor from the Myxomycetes Chair proof of concept to all work records; other admin sections keep the existing renderer.
- [x] Use a page-specific Puck config for work metadata, left gallery, and reorderable right-column content blocks.

### Task 2: Bridge existing Work JSON

**Files:** `src/lib/admin/puck-work-document.js`, `scripts/local-admin/app.js`, `scripts/local-admin/storage.mjs`

- [x] Map supported current Work fields and section block kinds to Puck data and back.
- [x] Send every Puck change into the existing draft state and dirty indicator.
- [x] Keep save/reload on the current API and preserve template/SEO fields through Puck.

### Task 3: Integrate the management layout

**Files:** `scripts/local-admin/index.html`, `scripts/local-admin/styles.css`, `src/components/admin/PuckWorkEditor.jsx`

- [x] Use one component insertion surface for the Puck editor, with the canvas as the main area and component controls at the right edge.
- [x] Preserve the top-level save status and save button; avoid duplicate publish controls.
- [x] Inspect product, visual, research, and another existing admin section locally, then run `npm run build`.
