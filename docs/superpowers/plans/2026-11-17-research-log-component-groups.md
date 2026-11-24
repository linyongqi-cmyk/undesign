# Research Log component groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let editors group consecutive Research Log components into a zero-gap group that remains editable, movable, and reversible.

**Architecture:** Store a group as a nested `componentGroup` content block and map it to a Research Log-only Puck component with a nested `DropZone`. Add an explicit selection mode that selects consecutive top-level component IDs and wraps them into one Puck group; public rendering recursively renders the children with zero gap. Ordinary work detail pages retain their current schema and rendering behavior.

**Tech Stack:** Astro, React, Puck `@puckeditor/core`, TypeScript content types, existing global CSS.

**Spec:** `docs/superpowers/specs/2026-11-17-research-log-component-groups-design.md`

## Global Constraints

- “The feature is available only in the Research Log canvas. Ordinary work detail pages remain unchanged.”
- “A group preserves the selected components' order and occupies their original position in the article.”
- “Components inside a group render as a vertical stack with zero gap.”
- “Editors can ungroup to restore the children as separate top-level components in the same order.”
- Do not add or run tests; verify with `npm run build` and direct local editor/page checks.

## Review Focus

- Legacy Research Log blocks without groups must round-trip without content or ID loss; verify by opening and saving a legacy article locally.
- Group children must preserve their order and content through group, save, reload, and ungroup; verify this sequence in the local editor.
- Nested groups must not be created; keep the Group action limited to top-level consecutive selections.
- Ordinary detail pages must not expose group controls or change their block layout; open a standard and split-detail page in the local editor.
- Zero gap must apply between group children without changing the spacing between the group and its neighboring article blocks; inspect a grouped public Research Log article.

---

### Task 1: Add Research Log group data conversion

**Files:**
- Modify: `src/lib/content/types.ts`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/lib/content/work-body-sections.js`

**Interfaces:**
- Content block: `{ kind: 'componentGroup'; items: ContentBlock[] }`
- Puck type: `ResearchGroupBlock`; nested child zone key: `${groupId}:items`
- `workToPuckDocument(work)` emits group blocks only through the Research Log conversion path.
- `puckDocumentToWork(document, original)` restores the nested child zone as `componentGroup.items`.

- [ ] Add the `componentGroup` content-block type and recursive Puck conversion for its children, preserving child order and content.
- [ ] Confirm an empty or malformed group safely converts to no group rather than dropping neighboring blocks.
- [ ] Include nested group text in Research Log language detection so grouping cannot change the selected Chinese/Japanese font.
- [ ] Inspect the converted document from a representative Research Log article and run `npm run build`.

### Task 2: Add Research Log selection, grouping, and ungrouping controls

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/styles.css`

**Interfaces:**
- Add a `ResearchGroupBlock` Puck component that renders `DropZone zone="items"`; Puck stores the zone at `${groupId}:items`.
- Add editor state for selection mode, selected top-level IDs, and an invalid nonconsecutive-selection message.
- Group and ungroup transformations use the existing Puck `dispatch({ type: 'setData', data })` bridge and remain undoable.

- [ ] Add a Research Log-only “选择组件” toggle and a selection toolbar with Group and Cancel controls.
- [ ] Resolve clicks from `[data-puck-component]` to IDs in the Research Log top-level content array; allow only consecutive ranges and require at least two blocks to group.
- [ ] Group the selected blocks in their current position and order; leave a clear state when a nonconsecutive block is clicked.
- [ ] Add an ungroup action on `ResearchGroupBlock` that restores its children to the same parent zone in order.
- [ ] Ensure selection mode intercepts component selection only while active and never intercepts toolbar buttons or input fields.
- [ ] Confirm controls are not rendered for ordinary detail pages and run `npm run build`.

### Task 3: Render zero-gap groups in public Research Logs

**Files:**
- Modify: `src/components/content/ContentBlock.astro`
- Modify: `src/pages/works/[category].astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Pass a Research Log flag to `ContentBlock`; recursively render `componentGroup.items` only for Research Log content.
- Use `.research-component-group` as the public wrapper class and set its child layout gap to `0`.

- [ ] Render a Research Log group wrapper and recursively render its children in order.
- [ ] Reset group-child margins and gap to zero while preserving the parent research article's 12px gap around the group.
- [ ] Inspect a local grouped article and run `npm run build`.

### Task 4: Verify grouping workflow and compatibility

**Files:**
- No additional files unless verification reveals a defect.

- [ ] In `/admin/`, select two adjacent Research Log components, group them, save, reload, and confirm the group and order persist.
- [ ] Confirm the children remain editable, the group moves as one block, and ungroup restores separate blocks.
- [ ] Confirm a nonconsecutive selection cannot be grouped and the ordinary Product detail editor has no group mode.
- [ ] Inspect the public Research Log spacing: zero between children and the existing outer spacing around the group.
- [ ] Run `npm run build` and report the observed result.
