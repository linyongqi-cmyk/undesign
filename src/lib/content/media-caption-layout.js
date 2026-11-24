// Keeps media side by side in one horizontal row aligned when only some of
// them carry an external caption above the media. The tallest top caption sets
// a common media top line; every other item is pushed down by the difference,
// so all images/videos in the row start at the same height.
const rowContainers = [
  '.layout-group-items',
  '.detail-media-composition',
  '.puck-media-stack-columns',
  '.free-size-media-track',
  '.puck-free-size-track',
  '.detail-image-pair',
].join(', ');

function captionUnit(item) {
  if (!item) return null;
  if (item.matches('[data-caption-position]')) return item;
  return item.querySelector('[data-caption-position]');
}

function captionSpace(unit, position) {
  if (!unit || unit.dataset.captionPosition !== position) return 0;
  const caption = unit.querySelector(':scope > .media-caption');
  if (!caption) return 0;
  const style = getComputedStyle(caption);
  const gap = parseFloat(position === 'top' ? style.marginBottom : style.marginTop) || 0;
  return (parseFloat(style.height) || caption.offsetHeight) + gap;
}

export function topCaptionSpace(item) {
  return captionSpace(captionUnit(item), 'top');
}

export function bottomCaptionSpace(item) {
  return captionSpace(captionUnit(item), 'bottom');
}

function isHorizontalRow(element) {
  const style = getComputedStyle(element);
  if (style.display === 'flex') return style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
  if (style.display !== 'grid') return false;
  if (style.gridAutoFlow.split(/\s+/).includes('column')) return true;
  return style.gridTemplateColumns.split(/\s+/).filter(Boolean).length > 1;
}

function isMediaItem(item) {
  return Boolean(item.matches('[data-caption-position]')
    || item.querySelector('[data-caption-position], .detail-image, .detail-image-pair-frame, .detail-media-composition-item, .detail-video, .free-size-media-frame, .free-size-media-carousel, .free-size-video, .source-media-card, .puck-image-editor, .puck-image-carousel-editor, .puck-grouped-video, .puck-video-embed-preview, .puck-source-card-editor, img, video, iframe'));
}

function clearCaptionShift(item) {
  if (!item.hasAttribute('data-caption-aligned')) return;
  item.removeAttribute('data-caption-aligned');
  item.style.marginTop = '';
  item.style.paddingTop = '';
}

/** @param {Document | Element} [root] */
export function alignMediaCaptionRows(root = document) {
  if (!root?.querySelectorAll) return;
  for (const container of root.querySelectorAll(rowContainers)) {
    const items = [...container.children];
    const spaces = items.map(topCaptionSpace);
    const horizontal = isHorizontalRow(container);
    const maxTop = horizontal ? Math.max(0, ...spaces) : 0;
    // Fixed-height image rows reserve the caption space in the row height;
    // padding keeps the media viewport at the configured height.
    const fixedRow = container.closest('[data-image-row-mode="fixedHeight"]');
    items.forEach((item, index) => {
      const shift = isMediaItem(item) && maxTop > spaces[index] ? maxTop - spaces[index] : 0;
      if (!shift) {
        clearCaptionShift(item);
        return;
      }
      item.setAttribute('data-caption-aligned', '');
      if (fixedRow) {
        item.style.marginTop = '';
        item.style.paddingTop = `${shift}px`;
      } else {
        item.style.paddingTop = '';
        item.style.marginTop = `${shift}px`;
      }
    });
  }
}
