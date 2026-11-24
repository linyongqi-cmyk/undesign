const textKinds = new Set(['paragraph', 'richText', 'note', 'specifications', 'internalLink', 'externalLink', 'quote']);
const isText = (item) => item.kind === 'content' && textKinds.has(item.block?.kind);

export function getOverflowTextLayout(columns, overflowRight) {
  if (!overflowRight || columns.length < 2) return {};
  const [left, right] = columns;
  const [lead] = left.items || [];
  const [image, ...text] = right.items || [];
  if (columns.length === 2 && left.items.length === 1 && lead.block?.kind === 'localVideo'
    && image?.kind === 'image' && text.length && text.every(isText)) {
    return { stack: true };
  }
  const textColumn = columns.findIndex(({ items }, index) => index > 0 && items.length && items.every(isText));
  if (textColumn > 0) return { inlineColumns: textColumn };
  return {};
}

// A row can share one media height when each column has one image or video.
export function isEqualHeightMediaRow(columns, overflowRight) {
  return Boolean(overflowRight && columns.length > 1 && columns.every(({ items }) => {
    if (items?.length !== 1) return false;
    const [item] = items;
    return item.kind === 'image' || item.block?.kind === 'localVideo';
  }));
}

export function bindMediaRow(row) {
  const lead = row.querySelector('[data-media-row-column] :is(img,video)');
  const updateRatio = () => {
    const width = lead?.videoWidth || lead?.naturalWidth;
    const height = lead?.videoHeight || lead?.naturalHeight;
    if (width && height) row.style.setProperty('--media-row-ratio', String(width / height));
  };
  lead?.addEventListener('load', updateRatio);
  lead?.addEventListener('loadedmetadata', updateRatio);
  updateRatio();
  return () => {
    lead?.removeEventListener('load', updateRatio);
    lead?.removeEventListener('loadedmetadata', updateRatio);
    row.style.removeProperty('--media-row-ratio');
  };
}

export function overflowRowSettings(settings, stretchByDefault) {
  return {
    align: settings?.align || (stretchByDefault ? 'stretch' : 'top'),
    gap: typeof settings?.gap === 'number' ? `${settings.gap}px`
      : settings?.gap === 'media' ? '12px' : 'var(--description-gap, 48px)',
    textWidth: typeof settings?.textWidth === 'number' ? settings.textWidth / 100 : undefined,
  };
}

export function bindOverflowRow(row) {
  const layout = row.closest('.split-detail-layout');
  const gallery = row.closest('.split-detail-gallery');
  const frame = row.matches('[data-overflow-video-stack]')
    ? row.querySelector('[data-overflow-side="start"] :is(figure, .puck-image-viewport)')
    : null;
  const image = frame?.querySelector('img');
  let animation = 0;
  const update = () => {
    animation = 0;
    if (layout && gallery) {
      const gap = parseFloat(getComputedStyle(layout).columnGap);
      if (Number.isFinite(gap)) row.style.setProperty('--description-gap', `${gap}px`);
      row.style.setProperty('--overflow-space', `${Math.max(0, layout.clientWidth - gallery.clientWidth)}px`);
    }
    if (image?.naturalWidth && frame.offsetHeight && frame.clientWidth) {
      const width = Math.min(frame.clientWidth, frame.clientHeight * image.naturalWidth / image.naturalHeight);
      row.style.setProperty('--overflow-image-width', `${Math.floor(width)}px`);
    }
  };
  const schedule = () => {
    if (!animation) animation = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(schedule);
  for (const target of [layout, gallery, frame]) if (target) observer.observe(target);
  image?.addEventListener('load', schedule);
  update();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(animation);
    image?.removeEventListener('load', schedule);
  };
}
