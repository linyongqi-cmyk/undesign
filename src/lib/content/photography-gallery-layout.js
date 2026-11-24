/** @typedef {{image: import('./types').ContentImage, index: number, aspect: number}} PhotographyGalleryItem */

/** @param {PhotographyGalleryItem[]} items @returns {PhotographyGalleryItem[][]} */
export function distributePhotographyGallery(items = []) {
  const columns = [[], []];
  const heights = [0, 0];
  for (const item of items) {
    const aspect = Number(item.aspect) > 0 ? Number(item.aspect) : 1;
    const column = heights[0] <= heights[1] ? 0 : 1;
    columns[column].push(item);
    heights[column] += 1 / aspect;
  }
  return columns;
}

export function sortPhotographyGalleryVisualOrder(entries = [], rowTolerance = 2) {
  const sorted = entries
    .map((entry, index) => ({ ...entry, index, top: Number(entry.top), left: Number(entry.left) }))
    .filter((entry) => Number.isFinite(entry.top) && Number.isFinite(entry.left))
    .sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index);
  const rows = [];

  for (const entry of sorted) {
    let row = rows.at(-1);
    if (!row || entry.top - row.anchorTop > rowTolerance) {
      row = { anchorTop: entry.top, entries: [] };
      rows.push(row);
    }
    row.entries.push(entry);
  }

  return rows.flatMap((row) => row.entries.sort((a, b) => a.left - b.left || a.index - b.index).map((entry) => entry.id));
}
