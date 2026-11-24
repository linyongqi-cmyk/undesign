# Fixed-Height Image Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switchable fixed-height proportional image-row mode and unify Research Log edit/delete controls.

**Architecture:** Extend existing horizontal layout-group props and renderer with a row mode and height. Reuse its current width boundary and image replacement path to calculate whether a candidate image fits, and use shared CSS selectors for admin and public rendering.

**Tech Stack:** Astro, React, Puck, CSS, existing local-admin data conversion.

**Spec:** [2026-11-18-fixed-height-image-row-design.md](../specs/2026-11-18-fixed-height-image-row-design.md)

## Global Constraints

- Keep current mode A as the default and preserve saved layout-group documents.
- Mode B starts at 200px, keeps displayed image ratios, and rejects only candidates that exceed available rightward space. The settings panel offers 70/100/150% and 200/256/320px presets.
- Do not edit portfolio content, publish, or add/run tests; run `npm run build` and visually inspect the relevant local pages.

## Review Focus

- A candidate image fits exactly at the remaining canvas width and must be accepted.
- A wider candidate is rejected without blocking a later fitting candidate.
- Replacing an image recalculates its row width using the replacement's aspect ratio.
- Switching modes persists across editor conversion and public rendering.
- Mode A and mixed image/text groups retain their current layout.

### Task 1: Add fixed-height proportional image mode

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/lib/content/types.ts`
- Modify: `src/components/content/ContentBlock.astro`
- Modify: `src/lib/content/layout-group.js`
- Modify: `src/styles/global.css`
- Modify: `scripts/local-admin/styles.css`

- [ ] Add persisted `rowMode` and `rowHeight` fields to horizontal `LayoutGroupBlock`, defaulting existing groups to mode A and using 200px for mode B.
- [ ] Add mode and size controls to the horizontal group settings; show a width field in mode A and fixed height in mode B.
- [ ] Render eligible single-image rows at shared height with natural/frame-ratio widths, extending rightward within the measured available extent.
- [ ] Reuse the existing image add/replace interactions to check the candidate's projected total row width; reject only a non-fitting candidate and show a localized fit message.
- [ ] Preserve mode/height during Puck conversion and public content rendering through `puck-work-document.js` and `ContentBlock.astro`; leave mixed groups and mode A unchanged.
- [ ] Run `npm run build` and visually inspect the local editor and saved work page in modes A and B.

### Task 2: Unify Research Log row action buttons

**Files:**
- Modify: `scripts/local-admin/preview.js`
- Modify: `scripts/local-admin/styles.css`

- [ ] Apply the existing work-card icon-button class consistently to Research Log edit and delete actions.
- [ ] Inspect the Research Log list at desktop and narrow viewport widths.

### Task 3: Final verification

**Files:**
- No additional files.

- [ ] Run `npm run build` after all edits and confirm a zero exit code.
- [ ] Confirm existing content still defaults to mode A and that the category-list controls have matching dimensions and border treatment.
