import { alignMediaCaptionRows, bottomCaptionSpace, topCaptionSpace } from './media-caption-layout.js';

function groupTrack(group) {
  return group.querySelector(':scope > .layout-group-items, :scope > div > .layout-group-items');
}

function groupItems(track) {
  return [...(track?.children || [])].filter((item) => item.matches('[data-layout-item], [data-puck-component]'));
}

function aspectRatio(element) {
  const [width, height = 1] = (element.style.aspectRatio || (element.hasAttribute('data-side-fitted-media') ? '' : getComputedStyle(element).aspectRatio)).split('/').map(Number);
  return width > 0 && height > 0 ? width / height : 0;
}

function mediaRatio(item, lockMediaFrame) {
  const carousel = item.querySelector('.detail-image-carousel-slides, .puck-image-carousel-editor');
  const previewCarousel = carousel?.matches('.puck-image-carousel-editor');
  const media = carousel
    ? carousel.querySelector(previewCarousel ? '.puck-carousel-thumbnail-row img[src]' : 'img[src]')
    : item.matches('.source-media-card') ? item : item.querySelector('.source-media-card, img[src], video, iframe, .puck-video-embed-preview');
  if (!media) return 1;
  const frame = previewCarousel
    ? carousel.querySelector('.puck-image-viewport')
    : media.closest('figure[style*="aspect-ratio"], .puck-image-viewport') || media;
  const video = media.matches('video, iframe, .puck-video-embed-preview');
  const ratio = video
    ? media.videoWidth / media.videoHeight || 16 / 9
    : (frame && aspectRatio(frame)) || media.naturalWidth / media.naturalHeight || 1;
  if (video && lockMediaFrame) {
    media.style.setProperty('--layout-video-ratio', ratio);
    media.toggleAttribute('data-layout-video-frame', true);
  }
  if (carousel && lockMediaFrame) {
    carousel.style.setProperty('--layout-carousel-ratio', ratio);
    carousel.toggleAttribute('data-fixed-layout-carousel', true);
  }
  return ratio;
}

// For each item, height = slope * width + offset. The offset preserves fixed
// gaps inside nested groups when the parent gives its children a common height.
function dimensions(item, lockMediaFrame = false) {
  const nested = item.querySelector('[data-content-layout]');
  const track = nested && groupTrack(nested);
  const items = groupItems(track);
  if (!items.length || nested.dataset.contentLayout === 'side') {
    const slope = 1 / mediaRatio(item, lockMediaFrame);
    const indent = item.matches('[data-media-indent]') ? item : item.querySelector('[data-media-indent]');
    const inset = indent ? parseFloat(getComputedStyle(indent).paddingLeft) || 0 : 0;
    return { slope, offset: -inset * slope };
  }
  const parts = items.map((child) => dimensions(child, lockMediaFrame));
  const { rowGap, columnGap } = getComputedStyle(track);
  if (nested.dataset.contentLayout === 'column') {
    return {
      slope: parts.reduce((sum, part) => sum + part.slope, 0),
      offset: parts.reduce((sum, part) => sum + part.offset, (parseFloat(rowGap) || 0) * (parts.length - 1)),
    };
  }
  const slope = 1 / parts.reduce((sum, part) => sum + 1 / part.slope, 0);
  return {
    slope,
    offset: slope * parts.reduce((sum, part) => sum + part.offset / part.slope, -(parseFloat(columnGap) || 0) * (parts.length - 1)),
  };
}

export function itemRatio(item) {
  return 1 / dimensions(item).slope;
}

export function displayWidthStyle(value) {
  return Number.isInteger(value) && value >= 10 && value <= 200
    ? { '--display-width': `${value}%` }
    : undefined;
}

function layoutBoundary(element) {
  return element.closest('.split-detail-layout, .puck-work-sheet, .site-main');
}

function availableRight(element) {
  const boundary = layoutBoundary(element);
  if (!boundary || !element.offsetWidth) return 0;
  const rect = element.getBoundingClientRect();
  const bounds = boundary.getBoundingClientRect();
  const zoom = rect.width / element.offsetWidth || 1;
  const padding = boundary.matches('.site-main') ? parseFloat(getComputedStyle(boundary).paddingRight) || 0 : 0;
  return Math.max(0, (bounds.right - rect.left) / zoom - padding);
}

export function layoutAvailableWidth(element) {
  return availableRight(element);
}

function updateSideGroups(root) {
  const scopes = new Map();
  for (const group of root.querySelectorAll('[data-content-layout="side"]')) {
    const aside = group.querySelector(':scope > .layout-side-items');
    const boundary = layoutBoundary(group);
    if (!aside || !boundary || !group.offsetWidth) continue;
    const available = availableRight(group);
    group.style.setProperty('--layout-available', `${available}px`);
    const gap = parseFloat(getComputedStyle(group).getPropertyValue('--layout-side-gap')) || 0;
    group.toggleAttribute('data-side-inline', available - group.offsetWidth - gap < 120);
    if (getComputedStyle(aside).position !== 'absolute') {
      aside.querySelector('[data-side-fitted-media]')?.removeAttribute('data-side-fitted-media');
      group.style.removeProperty('--group-tools-left');
      continue;
    }
    const rect = group.getBoundingClientRect();
    if (!rect.width) continue;
    const zoom = rect.width / group.offsetWidth;
    const occupied = scopes.get(boundary) || [];
    if (!scopes.has(boundary)) {
      const independent = boundary.querySelector(':scope > .split-detail-info');
      if (independent?.offsetHeight) occupied.push(independent.getBoundingClientRect());
      for (const wide of boundary.querySelectorAll('[data-display-width]')) {
        if (Number(wide.dataset.displayWidth) > 100 && wide.getBoundingClientRect().right > rect.right + gap * zoom) {
          occupied.push(wide.getBoundingClientRect());
        }
      }
      scopes.set(boundary, occupied);
    }
    const rightItems = aside.querySelector(':scope > .puck-side-dropzone') || aside;
    const items = [...rightItems.children].filter((element) => !element.matches('script, style'));
    const single = items.length === 1 ? items[0] : null;
    const nestedGroup = single?.querySelector('[data-content-layout], [data-free-size-group], .detail-media-composition, .puck-media-composition-editor, .research-component-group');
    const media = !nestedGroup && (single?.matches('.detail-image, .source-media-card') ? single : single?.querySelector(
      '.source-media-card, .puck-image-viewport, .detail-image-carousel-slides, .puck-video-embed-preview, .detail-image, .detail-video > video, .detail-video > iframe, .puck-grouped-video video'
    ));
    // Fit a single media frame without changing the left anchor or its following block.
    const fitted = aside.querySelector('[data-side-fitted-media]');
    if (fitted && (fitted !== media || !group.hasAttribute('data-side-match-height'))) fitted.removeAttribute('data-side-fitted-media');
    if (media && group.hasAttribute('data-side-match-height')) {
      const ratio = mediaRatio(single, false);
      const width = Math.min(aside.clientWidth, group.offsetHeight * ratio);
      media.style.setProperty('--layout-fit-width', `${width}px`);
      media.style.setProperty('--layout-fit-ratio', ratio);
      media.toggleAttribute('data-side-fitted-media', true);
    }
    const height = aside.getBoundingClientRect().height;
    const alignBottom = group.dataset.sideAlign === 'bottom';
    const text = single?.matches('.detail-copy, .detail-subheading') ? single : single?.querySelector('.detail-copy, .detail-subheading');
    const asideRect = aside.getBoundingClientRect();
    const textRect = !media && text ? text.getBoundingClientRect() : asideRect;
    let top = alignBottom ? rect.bottom - (textRect.bottom - asideRect.top) : rect.top - (textRect.top - asideRect.top);
    const rightEdge = items.length ? (aside.querySelector('[data-side-fitted-media]') || aside).getBoundingClientRect().right : rect.right;
    group.style.setProperty('--group-tools-left', `${(rightEdge - rect.left) / zoom}px`);
    for (const existing of occupied.toSorted((a, b) => a.top - b.top)) {
      if (top + height + 12 * zoom > existing.top && top < existing.bottom + 12 * zoom) top = existing.bottom + 12 * zoom;
    }
    group.style.setProperty('--layout-side-offset', `${(top - rect.top) / zoom}px`);
    occupied.push({ top, bottom: top + height });
  }
  for (const boundary of root.querySelectorAll('[data-layout-side-boundary]')) {
    if (scopes.has(boundary)) continue;
    boundary.removeAttribute('data-layout-side-boundary');
    boundary.style.removeProperty('--layout-min-height');
  }
  for (const [boundary, occupied] of scopes) {
    boundary.toggleAttribute('data-layout-side-boundary', true);
    const bounds = boundary.getBoundingClientRect();
    const zoom = bounds.width / boundary.offsetWidth || 1;
    const bottom = Math.max(...occupied.map((entry) => entry.bottom));
    const padding = parseFloat(getComputedStyle(boundary).paddingBottom) || 0;
    const minimum = Math.ceil((bottom - bounds.top) / zoom + padding);
    boundary.style.setProperty('--layout-min-height', `${minimum}px`);
  }
}

export function updateLayoutGroups(root) {
  for (const block of root.querySelectorAll('[data-display-width]')) {
    if (Number(block.dataset.displayWidth) > 100) {
      block.style.setProperty('--layout-available', `${availableRight(block)}px`);
    }
  }
  for (const group of root.querySelectorAll('[data-content-layout="row"], [data-content-layout="overflow"]')) {
    const track = groupTrack(group);
    const items = groupItems(track);
    if (!track || !items.length) continue;
    if (group.dataset.imageRowMode === 'fixedHeight') {
      const height = Math.max(80, Number(group.dataset.imageRowHeight) || 200);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const widths = items.map((item) => {
        const { slope, offset } = dimensions(item);
        return (height - offset) / slope;
      });
      const width = widths.reduce((sum, value) => sum + value, 0) + gap * (items.length - 1);
      const available = layoutAvailableWidth(group);
      group.style.setProperty('--image-row-height', `${height}px`);
      group.style.setProperty('--image-row-available', `${available}px`);
      group.toggleAttribute('data-image-row-overflow', available > 0 && width > available + 1);
      const shell = group.closest('.puck-media-drop-shell');
      shell?.style.setProperty('--image-row-available', `${available}px`);
      items.forEach((item, index) => {
        const itemWidth = widths[index];
        item.style.width = `${itemWidth}px`;
        item.style.flex = `0 0 ${itemWidth}px`;
      });
      // Captions live outside the fixed-height viewport. The row keeps every
      // media frame at the configured height and reserves the tallest top and
      // bottom captions so none of them is clipped.
      const topSpace = Math.max(0, ...items.map((item) => topCaptionSpace(item)));
      const bottomSpace = Math.max(0, ...items.map((item) => bottomCaptionSpace(item)));
      items.forEach((item) => {
        item.style.height = `${height + topSpace + bottomSpace}px`;
      });
      continue;
    }
    group.removeAttribute('data-image-row-overflow');
    group.style.removeProperty('--image-row-height');
    group.style.removeProperty('--image-row-available');
    group.closest('.puck-media-drop-shell')?.style.removeProperty('--image-row-available');
    items.forEach((item) => {
      item.style.removeProperty('width');
      item.style.removeProperty('height');
      item.style.removeProperty('flex');
    });
    const parts = items.map((item) => dimensions(item, true));
    const overflow = group.dataset.contentLayout === 'overflow';
    if (overflow) {
      const ratios = parts.map(({ slope }) => 1 / slope);
      group.style.setProperty('--layout-group-columns', ratios.map((ratio) => `${100 * ratio / ratios[0]}%`).join(' '));
      continue;
    }
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const available = track.clientWidth - gap * (parts.length - 1);
    if (available <= 0) continue;
    const height = (available + parts.reduce((sum, { offset, slope }) => sum + offset / slope, 0))
      / parts.reduce((sum, { slope }) => sum + 1 / slope, 0);
    const widths = parts.map(({ slope, offset }) => (height - offset) / slope);
    const columns = widths.every((width) => width > 0) ? widths : parts.map(({ slope }) => 1 / slope);
    group.style.setProperty('--layout-group-columns', columns.map((width) => `minmax(0, ${width}fr)`).join(' '));
  }
  updateSideGroups(root);
  for (const shell of root.querySelectorAll('.puck-media-drop-shell')) {
    const component = shell.closest('[data-puck-component]');
    if (!component || !component.offsetWidth) continue;
    const content = shell.querySelector(':scope > [data-content-layout="side"]');
    const sideRight = Number.parseFloat(content?.style.getPropertyValue('--group-tools-left'));
    const width = Math.max(shell.offsetWidth, sideRight || 0);
    component.style.setProperty('--canvas-selection-width', `${width}px`);
  }
  alignMediaCaptionRows(root);
}

export function observeLayoutGroups(root) {
  if (!root) return;
  let pending = 0;
  const observed = new Set();
  const schedule = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      const elements = new Set(root.querySelectorAll('[data-content-layout], .layout-side-items, [data-display-width], .split-detail-info'));
      if (!elements.size && !observed.size) return;
      for (const element of observed) if (!elements.has(element)) resize.unobserve(element);
      for (const element of elements) if (!observed.has(element)) resize.observe(element);
      observed.clear();
      elements.forEach((element) => observed.add(element));
      updateLayoutGroups(root);
    });
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(root instanceof Document ? root.documentElement : root);
  const mutation = new MutationObserver((changes) => {
    if (changes.some(({ addedNodes, removedNodes, type }) => type === 'attributes'
      || [...addedNodes, ...removedNodes].some((node) => node.nodeType === 1))) schedule();
  });
  mutation.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'open', 'data-display-width', 'data-content-layout', 'data-image-row-mode', 'data-image-row-height', 'data-side-match-height', 'data-side-align'] });
  root.addEventListener('load', schedule, true);
  root.addEventListener('loadedmetadata', schedule, true);
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    cancelAnimationFrame(pending);
    resize.disconnect();
    mutation.disconnect();
    root.removeEventListener('load', schedule, true);
    root.removeEventListener('loadedmetadata', schedule, true);
    window.removeEventListener('resize', schedule);
  };
}
