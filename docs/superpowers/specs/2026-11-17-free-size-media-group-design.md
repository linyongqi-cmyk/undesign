# Free Size Media Group and Disclaimer Card

## Intent

Make the existing “Right (Extend)” placement create a group whose media items can be resized from a shared height reference while keeping their proportions. Replace the obsolete Free Ratio Image Group drawer item with a linked disclaimer card that is useful in work details and research logs.

## Goals

- Replace “Right (Extend)” with a dedicated Free Size Group.
- Support two sizing modes: a work detail mode based on one anchor item and a research mode based on a user-set height.
- Keep group items in one horizontal sequence, with their order editable.
- Make the disclaimer card a portrait 3:4 bordered card with editable text and an optional external URL set through its control button.
- Remove Free Ratio Image Group from the editor and content model.

## Non-goals

- Arbitrary x/y placement of items inside the group.
- Text blocks as Free Size Group items; the sizing model requires a media aspect ratio.
- Changes to ordinary `mediaComposition` columns or existing saved `layoutGroup` layouts.
- Image generation or changes to portfolio copy.

## Approaches

1. **Dedicated Free Size Group type (selected).** Add a distinct content kind and Puck component. Map “Right (Extend)” to it and store its mode and item sizing settings separately. This matches the new behavior and keeps current media composition and overflow semantics intact.
2. **Extend Media Composition.** Add sizing modes to `mediaComposition`. This reuses its item model but mixes the new shared-height behavior with existing column and overflow settings.

The user selected the dedicated type and horizontal continuous arrangement. The group is constrained to its content width and scrolls horizontally when its sequence extends beyond that width, at desktop and mobile sizes. It does not wrap or create page-level horizontal overflow.

## Behavior and data

### Free Size Group

- Store as `kind: "freeSizeGroup"`, with ordered media items and a mode.
- “Right (Extend)” becomes “Free Size Group”. It groups the current component and dropped component; the current component is first.
- In work detail mode, the first item is the default anchor. It fills the available content width. Its displayed height becomes the group reference height; every following item uses that height and its own aspect ratio.
- In research mode, the group has a fixed editable height (default 320 CSS px). Every item uses that height and retains its aspect ratio.
- The mode can be switched in group settings. Work detail mode exposes anchor selection; research mode exposes height. Ordered items can be moved left or right with group controls.
- Supported items are image, image carousel, local video, online video embed, and disclaimer card. Text-only blocks and nested groups are not valid members because they have no intrinsic media ratio.
- An image uses its crop ratio when set, otherwise its natural dimensions. A carousel uses the first valid slide's crop or natural ratio as its stable item ratio; other slides fit inside that ratio without changing the group width. A local video uses its loaded metadata ratio, with a 16:9 placeholder before metadata loads. An online video embed uses 16:9. The disclaimer card uses 3:4.
- Read and render the legacy `layoutGroup` value `overflow` unchanged for existing records. No current portfolio JSON contains `freeImageGroup`, so remove that kind and its editor, renderer, and validator support without a data migration.

### Disclaimer card

- Keep the `sourceCard` content kind, remove its editable ratio, and render it at 3:4 with the existing simple border treatment.
- Keep disclaimer text editable through the card’s control button.
- Add an optional URL field to that control. When a valid URL is set, the whole card is clickable and opens the destination in a new tab with `noopener noreferrer`. Without a URL, it remains a non-clickable card.

## Constraints

- Keep the existing Astro, React, and Puck stack.
- Update the JSON content types, Puck conversion, local-admin validation, front-end rendering, and responsive CSS together.
- Reuse existing image aspect/crop metadata where present. For un-cropped images, derive aspect from the image’s natural dimensions.
- Keep the portfolio’s restrained visual style and verify the canvas and saved-page rendering.

## Builder calls

- The existing work component is the default anchor in work detail mode; users can select another item in group settings.
- Research mode defaults to 320 CSS px and remains editable.
- The group is a single horizontal sequence, constrained to the content width and horizontally scrollable when needed, rather than wrapping.
- Carousel sizing uses the first valid slide ratio, local video sizing uses metadata with a temporary 16:9 fallback, and online embeds use 16:9.
- Free Size Group is limited to media with known or defined ratios; text and nested groups remain separate content.
- The disclaimer URL opens a new tab, matching the existing external-link behavior.

## Approval state

Approved by the user on 2026-11-17; implementation completed.
