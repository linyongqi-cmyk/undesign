# Free Size Media Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace “Right (Extend)” with a proportion-preserving Free Size Group and turn Source Card into a linked 3:4 disclaimer card.

**Architecture:** Add a dedicated `freeSizeGroup` content kind with `work` and `research` sizing modes. Keep the public `mediaComposition` and legacy `layoutGroup` implementations intact, and render Free Size Groups with a shared horizontal sizing model. Keep `sourceCard` as a standalone block with an optional URL.

**Tech Stack:** Astro, React 19, Puck, TypeScript content types, CSS, local-admin JSON validation.

**Spec:** `docs/superpowers/specs/2026-11-17-free-size-media-group-design.md`

## Global Constraints

- Keep the existing Astro, React, and Puck stack.
- Keep Free Size Groups constrained to their content width; overflow scrolls within the group and does not wrap.
- The work mode anchor fills the content width; later items match its height and preserve their ratios.
- Research mode defaults to 320 CSS px; all items match that height and preserve their ratios.
- A carousel uses the first valid slide ratio, local video uses metadata with a temporary 16:9 fallback, online video uses 16:9, and the disclaimer card uses 3:4.
- Remove `freeImageGroup` support; no portfolio JSON currently uses it.
- Keep existing `mediaComposition` and saved `layoutGroup` behavior unchanged.
- Do not add or run a test suite; finish with `npm run build` and local browser inspection as required by project instructions.

## Review Focus

- Empty groups and empty media items must not break conversion or produce invalid width calculations. (Inspect add/remove boundaries in the Puck editor and storage validator.)
- Crop aspect and natural aspect must use the same width-over-height convention. (Inspect the image source and crop data used by both renderers.)
- A carousel whose slides have different ratios must keep a stable group slot. (Use the first valid slide's ratio and contain later slides.)
- Local video metadata may load after first render. (Keep 16:9 until metadata arrives, then update measured ratio.)
- An empty or malformed disclaimer URL must not create an unsafe anchor. (Validate URL at save and render only accepted external URLs.)

---

### Task 1: Content model, conversion, and placement

**Files:**
- Modify: `src/lib/content/types.ts`
- Modify: `src/lib/content/free-media.js`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/lib/admin/puck-media-placement.js`
- Modify: `scripts/local-admin/storage.mjs`

**Interfaces:**
- Produce `FreeSizeGroup = { kind: 'freeSizeGroup'; mode: 'work' | 'research'; anchorItemId?: string; height?: number; items: FreeSizeItem[] }`.
- Produce `FreeSizeItem = { id: string; kind: 'image'; image: ContentImage } | { id: string; kind: 'imageCarousel'; images: ContentImage[] } | { id: string; kind: 'localVideo'; src: string } | { id: string; kind: 'videoEmbed'; url: string; caption?: string } | { id: string; kind: 'sourceCard'; text: string; href?: string }`.
- Produce `SourceCard = { kind: 'sourceCard'; text: string; href?: string }`; its aspect ratio is fixed at 3:4.
- Convert between `freeSizeGroup` JSON and `FreeSizeGroupBlock`; map the “free size group” placement choice to that block.
- Remove `freeImageGroup` from accepted content and nested item types.
- Add URL validation to `sourceCard.href` and `FreeSizeItem.videoEmbed.url` based on the existing external-link and video-link rules.

- [ ] Define the source type and validation rules, including allowed media item kinds and external URL parsing.
- [ ] Update Puck conversion in both directions and create the Free Size Group block from placement with category-appropriate defaults (`research` for research categories, `work` otherwise).
- [ ] Remove the old free-image group mapping and validator branches after confirming no JSON data uses it.
- [ ] Inspect `src/data/content/works/` for `freeImageGroup`; expected: no occurrences and no migration required.

### Task 2: Public Free Size Group rendering

**Files:**
- Create: `src/components/content/FreeSizeMediaGroup.astro`
- Modify: `src/components/content/ContentBlock.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consume `{ mode, anchorId?, height?, items }` from the `freeSizeGroup` content block.
- Render each supported media item with a stable aspect ratio and group-specific width derived from the selected height.

- [ ] Render work mode with its anchor at `width: 100%` of the group viewport and following items at the anchor's rendered height.
- [ ] Render research mode with all media items at the configured height, default 320 CSS px.
- [ ] Keep the group as a single horizontal row and use an internal horizontal scroller when the row exceeds the content width.
- [ ] Render the disclaimer card as 3:4; wrap the complete card in an external link only when a valid URL is present.
- [ ] Remove the old `freeImageGroup` output branch and old free-image grid styles.

### Task 3: Puck editor and Free Size Group controls

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/styles.css`
- Modify: `src/lib/admin/puck-media-placement.js`

**Interfaces:**
- Add a `FreeSizeGroupBlock` Puck component backed by the source shape from Task 1.
- Group actions expose mode selection; work mode selects an anchor; research mode edits pixel height.
- Item actions add supported media, reorder items, replace media, or remove items.

- [ ] Replace the `Right (Extend)` placement option with `Free Size Group`; preserve other placement choices and `layoutGroup` overflow support.
- [ ] In the editor, default the inserted work component as the anchor; allow selecting a different anchor.
- [ ] In research mode, add an editable height control defaulting to 320 CSS px.
- [ ] Add horizontal reorder controls and media actions while hiding group controls in child-edit mode, following the existing group interaction pattern.
- [ ] Remove `FreeImageGroupBlock`, its drawer item, and its editor implementation.
- [ ] Verify Puck preview widths, action-rail placement, aspect preservation, and horizontal scrolling at desktop and mobile sizes.

### Task 4: Disclaimer card editor

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/styles.css`
- Modify: `src/lib/content/free-media.js`

**Interfaces:**
- Source card controls edit `{ text, href? }`; ratio is no longer user-configurable.

- [ ] Change the source-card preview to the bordered 3:4 disclaimer card.
- [ ] Add a control-button field for the optional external URL; preserve editing of the disclaimer text.
- [ ] Save valid external URLs only and make the card itself clickable in preview and public rendering.
- [ ] Remove the old editable-ratio field and obsolete free-media helper code.

### Task 5: Build and local review

**Files:**
- No additional files unless the implementation requires a correction.

- [ ] Run `npm run build`; fix any conversion, type, or rendering errors.
- [ ] Inspect the local admin page: remove the Free Ratio Image Group drawer item, verify both Free Size Group modes and controls, verify disclaimer text/URL controls, and check desktop/mobile group scrolling.
- [ ] Inspect one public work page and one research log page using a Free Size Group; confirm the two sizing modes, card link behavior, and no page-level horizontal overflow.
