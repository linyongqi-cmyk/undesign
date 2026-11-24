import { workThumbnail, thumbnailStyle } from './work-thumbnail.js';
// The same shortest-column layout is used by public pages and the editor canvas.
export function observeWorkMasonry(root = document) {
  const grids = [...root.querySelectorAll('[data-work-masonry]')];
  const cleanups = grids.map((grid) => {
    let width = -1;
    const cards = [...grid.children];
    const crops = new Map(cards.filter((card) => card.dataset.thumbCrop !== undefined).map((card) => [card, JSON.parse(card.dataset.thumbCrop)]));
    const layout = () => {
      const available = grid.clientWidth;
      if (!available) return;
      const style = getComputedStyle(grid);
      const columns = Number(style.getPropertyValue('--work-columns')) || 4;
      const gap = parseFloat(style.columnGap) || 16;
      const cardWidth = Math.max(1, (available - gap * (columns - 1)) / columns);
      const heights = Array(columns).fill(0);
      for (const card of cards) {
        const frame = card.querySelector('.work-image-wrap');
        const image = frame?.querySelector('img');
        if (crops.has(card)) card.style.cssText = thumbnailStyle(workThumbnail({ masonryThumbnail: crops.get(card) }, 'masonry', image?.naturalWidth / image?.naturalHeight || 1));
        const aspect = Number(card.dataset.thumbAspect) || (image?.naturalWidth / image?.naturalHeight) || 1;
        if (frame) frame.style.aspectRatio = String(aspect);
        const column = heights.indexOf(Math.min(...heights));
        Object.assign(card.style, { position: 'absolute', width: `${cardWidth}px`, left: `${column * (cardWidth + gap)}px`, top: `${heights[column]}px` });
        heights[column] += cardWidth / aspect + gap;
      }
      grid.style.position = 'relative';
      grid.style.height = `${cards.length ? Math.max(...heights) - gap : 0}px`;
      width = available;
    };
    const observer = new ResizeObserver(() => { if (grid.clientWidth !== width) layout(); });
    observer.observe(grid);
    grid.addEventListener('load', layout, true);
    grid.addEventListener('error', layout, true);
    layout();
    return () => { observer.disconnect(); grid.removeEventListener('load', layout, true); grid.removeEventListener('error', layout, true); };
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
