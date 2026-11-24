# Photography Gallery Lightbox Implementation Plan

> **Execution:** Implement inline in this session, following this plan task by task.

**Goal:** Add an opt-in lightbox and per-image photography description to the photography gallery, with the same viewer in the public page and the admin preview.

**Architecture:** Persist an explicit work-level boolean and per-gallery-image text field through the existing Puck/document/storage path. A small shared browser module will own visual-order sorting and native-dialog behavior; Astro and the admin canvas will each adapt their current gallery data and DOM positions into that module.

**Tech Stack:** Astro, React/Puck, native `<dialog>`, existing Node `node:test` checks.

**Spec:** `摄影图集点击放大与摄影说明-设计及实施.md`

## Global Constraints

- Legacy works default to disabled, and missing descriptions behave as empty text.
- The viewer applies only to photography gallery images, never intro images or other media.
- Sort by visible image viewport coordinates: top first, then left within rows anchored to the first top with a 2 CSS px tolerance.
- Admin clicks continue to select/edit; only an explicit preview action opens the viewer.
- Reuse the existing crop values and note typography preset; do not add a gallery dependency.
- Do not edit content JSON, publish, or push.

## Review Focus

- Repeated image paths retain separate descriptions and stable per-entry viewer identity.
- Near-row-boundary positions produce a transitive, deterministic visual order.
- Crop viewports and long multiline descriptions remain legible outside the image, with responsive placement and no overlap with the close control.
- Escape and arrow keys do not trigger editor shortcuts while the preview is open.
- Root-level values and descriptions survive template changes and Puck round trips.

---

### Task 1: Persist photography lightbox settings

**Files:** `src/lib/content/types.ts`, `src/lib/content/media-caption.js`, `src/lib/admin/puck-work-document.js`, `scripts/local-admin/storage.mjs`, `scripts/puck-work-document.test.mjs`.

- [x] Add `Work.photographyLightboxEnabled?: boolean` and `ContentImage.photographyDescription?: string`.
- [x] Preserve the description in `imageData()` and round-trip it with the root toggle through Puck conversions, including disabled and non-photography templates.
- [x] Validate the optional toggle as boolean and the optional description as text; keep string gallery entries valid.
- [x] Add tests for string-image compatibility, repeated image entries with distinct descriptions, and conversion round trips; run the targeted Node tests.

### Task 2: Shared viewer and visual ordering

**Files:** create `src/lib/content/photography-lightbox.js` and `scripts/photography-lightbox.test.mjs`; modify `src/styles/global.css`.

- [x] Export deterministic visual-order sorting using fixed row anchors with 2px tolerance.
- [x] Implement one native-dialog viewer for sizing, crop, note-style description, looping navigation, close/backdrop/Escape, focus and scroll restoration, stale-load protection, and next-image-only preloading.
- [x] Add isolated viewer styles, including mobile sizing and a reserved close control.
- [x] Test same-row left-to-right, top-first uneven rows, tolerance boundaries, and duplicate IDs by entry identity.

### Task 3: Frontend and admin integration

**Files:** `src/pages/works/[category]/[slug].astro`, `src/components/admin/PuckWorkEditor.jsx`, `src/styles/global.css`, and targeted tests as needed.

- [x] Add the photography-only root toggle beside the intro-width setting.
- [x] Add a distinct applied textarea for each gallery item's photography description and an explicit draft-aware preview action.
- [x] Add accessible public-page triggers only when enabled, excluding the existing link-label anchor.
- [x] Feed both surfaces the same viewer module, current crop settings, note preset, and layout-derived visual order.
- [x] Preserve normal gallery layout and admin selection/drag behavior.

### Task 4: Verify and record

**Files:** `交接.md`, `修改记录.md`.

- [x] Restart the Astro dev server; verify admin save/reload and compare the same work in canvas and public page.
- [x] Check desktop and mobile viewer, visual ordering, crop, descriptions, undo/redo, and legacy default-off behavior.
- [ ] Check clicking an existing photography link label while the lightbox is enabled; the available photography works do not have one.
- [x] Run `npm run build`, record actual results and unverified cases, bump front-end/admin versions independently, and do not publish.
- [x] Update handoff with current state, next steps/blockers, versions, and the latest five rounds; prepend one merged task entry to the change log.

### Follow-up visual refinements

- [x] Move the description outside the image, left-align it without a text background, and place it beside/above the image according to available width.
- [x] Render the close control as a bare cross, rename the intro width field to `UP/vw`, and move the lightbox toggle below the Photography category row.
- [x] Add an icon toggle below the image, collapsed by default; reveal the description below the image at half width for landscape images and full width for portrait images.
- [x] Use a down arrow when collapsed and a right arrow when expanded; align description text to the arrow's top and keep the image's position and dimensions fixed while toggling.
- [x] Keep the current description expanded/collapsed state while navigating between photos in one viewer session; start collapsed when opening a new session.
- [x] Constrain the arrow-and-description row to half width for landscape and image width minus 24px for portrait; use “正文段落” typography while retaining the prior 12px size in both previews.
