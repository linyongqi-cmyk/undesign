# Media Composition and Typography Design

## Goals

- Replace the fixed two-image pair with a media composition that can contain any number of image or image-carousel items in horizontal columns.
- Let users create a horizontal composition by dropping a media block at the right edge of another media block. A block dropped below remains an independent section.
- Keep columns equal-width. On phones, default to vertical stacking; provide a per-composition toggle to keep a horizontal, horizontally scrollable row.
- Keep one crop ratio across all slides in each carousel, and across media items in a composition where the ratio is shared by the media editor.
- Replace the single paragraph block with a text family: paragraph, note, internal link, external link. Each subtype has its own site-wide style preset, while each block stores its content/target.
- Save style presets in site content JSON and render them consistently across all affected public pages.

## Accepted interaction decisions

- “Add below” means a separate block, never a vertical media group.
- “Add to the right” means an equal-width horizontal media composition; membership can grow without a fixed item limit.
- Phone stacking is on by default. Turning it off preserves the horizontal row and enables horizontal scrolling.
- Internal links select a page/work; selecting the Research Log category also requires a specific research article.
- External links default to opening in a new tab.
- The old fixed “图片组合” block is removed from the add-content drawer and legacy visual preview.

## Data model

- Add `mediaComposition` with `items: (ContentImage | ImageCarouselItem)[]` and `stackOnMobile: boolean`; preserve existing `imagePair` through a migration to a two-item composition.
- Keep standalone `imageWithCaption` and `imageCarousel` blocks. Drag/drop normalization turns adjacent right-edge media drops into a composition without changing below-drop order.
- Add distinct text kinds for paragraph, note, internal link, and external link. Store editable content/target per block and refer to a style key; do not copy global style data into every block.
- Add four style presets under site settings. Presets cover font family, size, weight, color, line-height, letter spacing, alignment, decoration, casing, paragraph spacing/indent, and responsive overrides where applicable. Use project-local/system font stacks only.
- Internal target data stores category and optional work slug; rendering resolves it to the canonical URL. External URL rendering uses safe URL validation and `target="_blank" rel="noopener noreferrer"` by default.

## Editor and public rendering

- Puck configuration presents a “文字” drawer group with the four subtypes, plus standalone image, carousel, quote, and link-compatible existing content.
- A selected media composition exposes one shared crop-ratio control, per-item replace/crop/copy/remove actions, visible item numbering, and a phone stacking toggle. Carousel items retain manual controls and auto-rotation.
- A site-level typography panel edits each subtype preset and has an explicit save-to-site action. Apply the preset through CSS variables/classes shared by public renderers, including About text where relevant only if the existing subtype is used there.
- The public media composition renders equal columns on wide screens; on small screens it stacks by default or scrolls horizontally if stacking is off.
- Keep new behavior within existing minimal visual language and keyboard-accessible controls.

## Migration and compatibility

- Normalize legacy `imagePair` data into `mediaComposition` when read, and write the new kind on the next save. Do not lose image crop/alt/caption fields.
- Continue reading legacy `richText` and `link` blocks, mapping them to paragraph and external/internal link variants as deterministically as possible.
- Keep existing image carousel data and normalize each slide to the carousel's first valid crop ratio.

## Verification

- Build the Astro site.
- Check the Product/Lou admin editor, composition drag interaction, carousel shared crop ratio, text variants/style save, and one representative public detail route at desktop and mobile widths.
- Confirm old pair and legacy text data render after migration.

## Alternatives considered

- A fixed 2-image pair cannot represent an arbitrary horizontal row, so it is removed.
- Storing style on each block would make “save globally” unreliable, so block content points to shared subtype presets.
- A vertical split-drop zone is not introduced; below-drop is intentionally the existing independent-section behavior.
