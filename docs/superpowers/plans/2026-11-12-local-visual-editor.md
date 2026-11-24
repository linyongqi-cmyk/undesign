# Local Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split form-and-preview local manager with a structured single-canvas editor for all site content, and make public page navigation transitions visibly fade.

**Architecture:** Keep existing JSON drafts, local API, validation, and public page templates. Render page-specific editable canvas structures from the same draft object, with inline text editing, contextual image controls, insertion actions, and native drag ordering. Keep the left rail for choosing content and move specialized metadata into a contextual dialog/popover. Preserve detail hero and gallery fields separately from reorderable body sections.

**Tech Stack:** Astro 7, browser-native JavaScript modules, HTML contenteditable/drag-and-drop, CSS, existing local-admin API.

**Spec:** `docs/superpowers/specs/2026-11-12-local-visual-editor-design.md`

## Global Constraints

- Keep existing JSON content format, local write API, image directories, save button, and safety boundaries compatible.
- Keep public page templates, minimalist visuals, and responsive layouts unchanged.
- Do not introduce arbitrary pixel positioning or a new editor dependency.
- Detail hero and gallery remain after the heading; only `sections` reorder within the body.
- Management remains local-development-only; do not publish or push.
- Do not add or run tests unless the user asks; run `npm run build` and inspect the relevant local pages.

## Review Focus

- Inline edits containing newlines, HTML-like text, and IME composition remain plain text and preserve paragraph boundaries.
- Empty optional blocks and missing image assets render safely and remain editable.
- Drag sorting updates the correct section/category/work array and keeps order values consistent.
- Unsaved edits survive rerendering and failed saves without disappearing.
- Client-side route changes honor reduced-motion preferences and show a fade when motion is allowed.

---

### Task 1: Turn the editor surface into a single canvas

**Files:**
- Modify: `scripts/local-admin/index.html`
- Modify: `scripts/local-admin/styles.css`
- Modify: `scripts/local-admin/app.js`
- Modify: `scripts/local-admin/preview.js`

**Interfaces:**
- Consumes: `state.drafts`, current `renderPreview(container, section, draft, selectedCategory, selectedWork)`, existing local API functions.
- Produces: a single `#editor-canvas` whose page markup reads and writes `state.drafts`; `renderCanvas()` replaces dual form/preview rendering.

- [x] Remove the separate right-hand preview region and form editor structure. Keep left navigation and top save controls.
- [x] Convert the current preview renderer into a page-structure renderer with `data-edit-path` bindings and contenteditable text nodes for Home, About, Contact, categories, work list, and work detail.
- [x] Add CSS for canvas dimensions, selected/hover component outlines, editable text focus, empty states, and responsive canvas behavior.
- [x] Route input and composition events into the existing draft path setter; preserve plain text and multiline paragraph representation.
- [x] Manually inspect page types at desktop and narrow viewport; verify inline text editing and dirty status on a work detail draft.

### Task 2: Add visual component controls and ordering

**Files:**
- Modify: `scripts/local-admin/index.html`
- Modify: `scripts/local-admin/app.js`
- Modify: `scripts/local-admin/preview.js`
- Modify: `scripts/local-admin/styles.css`

**Interfaces:**
- Consumes: `renderCanvas()` and editable draft bindings from Task 1.
- Produces: insertion toolbar, selected-component actions, contextual properties dialog, and native drag sorting bound to existing arrays.

- [x] Add toolbar actions for the supported work body blocks and About content insertion.
- [x] Render drag handles, native drag events, and keyboard move controls for sortable lists, including work sections and works.
- [x] Add delete controls for removable components and retain safeguards for non-empty categories and referenced images.
- [x] Add contextual properties for image replacement/upload, image alt/caption, home cover scale/position/rotation, template, SEO, and slug metadata.
- [x] Ensure detail hero and gallery remain fixed after the heading; body sections are reorderable.
- [ ] Verify save/reload persistence against JSON. Not exercised in the browser to avoid writing test content into the user's portfolio data; draft edits, add-block, and reorder behavior were verified in memory.

### Task 3: Make public navigation fade reliably

**Files:**
- Modify: `src/layouts/SiteLayout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Astro `ClientRouter` and route transition directives.
- Produces: a reliable, accessible fade between public pages, respecting `prefers-reduced-motion`.

- [x] Reproduce client navigation between Home/About and About/Home in the local site.
- [x] Adjust transition duration/scope and preserve the reduced-motion override.
- [ ] Directly inspect the transition mid-animation and browser back/forward; the requested forward navigation directions and resulting routes were verified.
- [x] Manually inspect both requested navigation directions and a work detail route in the browser.

### Task 4: Build and verify the integrated result

**Files:**
- No additional files unless verification exposes a defect.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: buildable static site with local visual manager available only in dev.

- [x] Run `npm run build` and resolve any build errors.
- [x] Inspect `/admin/` and representative public routes locally, including mobile-sized admin layout and public navigation.
- [ ] Inspect Git status; this workspace has no `.git` metadata, so status is unavailable. No portfolio JSON was written by the browser draft interactions.

## Execution Notes

- No automated tests were added or run because the project `AGENTS.md` explicitly says not to add or run tests unless asked. Verification used JavaScript syntax checks, `npm run build`, and local browser inspection.
- No isolated worktree was possible because this workspace has no Git metadata; implementation stayed in the user-authorized project directory.
