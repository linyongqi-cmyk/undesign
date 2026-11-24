# Research Log component groups

## Intent

Allow editors to group consecutive components in a Research Log article so they can be managed as one unit while removing the normal spacing between the grouped components.

## Scope and behavior

- The feature is available only in the Research Log canvas. Ordinary work detail pages remain unchanged.
- Editors enter an explicit component selection mode, select a consecutive run of components, then choose **Group**. Selection mode avoids conflicts with the canvas's existing double-click editing and drag interactions.
- A group preserves the selected components' order and occupies their original position in the article.
- Components inside a group render as a vertical stack with zero gap. Components remain individually editable within the group; the group itself can be moved or deleted as one canvas block.
- Editors can ungroup to restore the children as separate top-level components in the same order.
- Grouping does not change typography settings or component content.

## Approaches considered

- **Shift-click multi-selection:** quick, but can conflict with existing canvas editing and drag gestures.
- **Explicit selection mode (recommended):** selection is unambiguous and can provide clear Group and Cancel controls; it adds a small mode toggle to the Research Log canvas.

## Implementation direction

Represent groups as a nested Research Log content block, with child component data stored and rendered in order. Keep group conversion and zero-gap styling scoped to Research Log. Use the existing Puck canvas to edit the group's children and move the group as a unit.

## Acceptance checks

- A consecutive run of two or more Research Log components can be grouped in place.
- The group's children keep their original order and have zero inter-component gap in the public article.
- Child components remain editable; the complete group can be moved or deleted.
- Ungrouping restores the original separate components and order.
- The group controls are absent from ordinary work detail pages, and those pages retain their current behavior.
- `npm run build` succeeds and the local Research Log editor and rendered page are checked.
