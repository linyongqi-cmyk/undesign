# Fixed-Height Image Row Design

## Intent

Add an optional proportional-height mode to horizontal `layoutGroup` rows made of single images. Mode A keeps the current fixed group width and equal-width columns. Mode B gives each image a shared, adjustable height (initially 200px), preserves its rendered aspect ratio, and extends the row to the right. The editor should reject only an image whose resulting row width exceeds the available canvas extent, explain why, and allow another image or replacement with a fitting ratio. Also make the Research Log row edit and delete buttons visually match the existing work-card icon buttons.

## Scope and constraints

- Store mode and height on the existing `layoutGroup`/`LayoutGroupBlock`; default old rows to mode A.
- Apply mode B only to continuous rows of single images; preserve existing rendering and behavior for mixed content, carousels, and videos.
- Persist mode and height through the local editor document conversion.
- Determine fit from each image's displayed aspect ratio, including any configured crop frame, plus row gaps and the current available canvas width.
- Do not alter portfolio content, publish, or add/run tests. Run the required Astro build and inspect the local editor and saved work page.

## Approaches

1. Extend existing horizontal layout groups with a row-mode and height setting. This preserves existing documents and insertion behavior, and lets the editor and public renderer share the same mode. **Selected.**
2. Rebuild the row on top of `FreeSizeGroupBlock`. This already supports variable item widths but changes the data model and editing controls beyond the requested mode switch.

## Design

Mode B uses a 200px initial shared frame height with a user-adjustable pixel height. Image widths follow the displayed image/frame ratios. The row remains capped at its available rightward canvas extent. Adding or replacing an image is accepted when the full row fits; otherwise the attempted image is not committed and the editor shows a concise fit warning. Changing the height or using an image with a narrower ratio allows the editor to recalculate the fit. Mode A remains unchanged. The settings panel labels the modes Width and Height and offers width presets of 70%, 100%, and 150%, and height presets of 200px, 256px, and 320px.

The Research Log edit and delete controls will use the same icon-button class and dimensions as the work-card controls.
