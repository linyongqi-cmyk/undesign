# Implementation Plan: Media Composition and Typography

1. **Content contracts and migrations**
   - Extend shared content types for media compositions and four text subtypes plus site-level typography presets.
   - Add compatibility normalization for old `imagePair`, `richText`, and `link` content.
   - Extend local admin storage validation and ensure image references survive round trips.

2. **Puck data conversion and editor behavior**
   - Replace `ImagePairBlock` drawer item with `MediaCompositionBlock` and keep standalone images/carousels.
   - Add a right-edge target/drop normalization so dropped media merges into an equal-width composition; below drop remains independent.
   - Add unlimited composition items, item numbering/actions, shared crop ratio, and mobile stack/scroll toggle.
   - Add four distinct text block types and per-type fields; add site-level style preset controls and explicit save action.

3. **Public rendering and styles**
   - Render media compositions and responsive stack/scroll behavior.
   - Render paragraph, note, internal/external links with shared style presets and safe link semantics.
   - Add site-wide style variables and update public links/typography while preserving current minimal layout.

4. **Legacy UI cleanup and local persistence**
   - Remove fixed pair choices/renderers from the old visual preview path.
   - Ensure site style edits save to `site.json` and work edits remain on the current work without navigation.
   - Restart the local admin service if needed.

5. **Verification**
   - Run `npm run build`.
   - Inspect the local admin editor and relevant public pages at desktop/mobile sizes; report any browser-only interactions not fully verified.
