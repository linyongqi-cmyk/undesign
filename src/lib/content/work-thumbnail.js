// Keep the two compositions independent when a category changes its layout.
export function workThumbnail(work, kind, naturalAspect = 1) {
  const masonry = kind === 'masonry';
  const crop = masonry ? work.masonryThumbnail || {} : {};
  const aspect = masonry ? Number(crop.aspect) || naturalAspect || 1 : 1;
  const scale = masonry ? Number(crop.scale) || 1 : Number(work.imageScale) || 1;
  const settings = {
    aspect, scale,
    position: masonry ? crop.position || 'center' : work.imagePosition || 'center',
  };
  if (masonry && Number.isFinite(crop.centerX) && Number.isFinite(crop.centerY)) {
    const width = Math.min(1, aspect / naturalAspect) / scale;
    const height = Math.min(1, naturalAspect / aspect) / scale;
    const x = Math.max(0, Math.min(1 - width, crop.centerX - width / 2));
    const y = Math.max(0, Math.min(1 - height, crop.centerY - height / 2));
    settings.window = { width, height, x, y };
  }
  return settings;
}

export function thumbnailImageStyle(settings) {
  const crop = settings.window;
  return crop ? {
    position: 'absolute', maxWidth: 'none', objectFit: 'fill', objectPosition: 'center', transform: 'none',
    width: `${100 / crop.width}%`, height: `${100 / crop.height}%`,
    left: `${-100 * crop.x / crop.width}%`, top: `${-100 * crop.y / crop.height}%`,
  } : { objectPosition: settings.position, transform: `scale(${settings.scale})` };
}

export function thumbnailStyle(settings) {
  const crop = settings.window;
  return `--thumb-aspect:${settings.aspect};--thumb-scale:${crop ? 1 : settings.scale};--thumb-position:${settings.position}` + (crop
    ? `;--thumb-width:${100 / crop.width}%;--thumb-height:${100 / crop.height}%;--thumb-left:${-100 * crop.x / crop.width}%;--thumb-top:${-100 * crop.y / crop.height}%`
    : '');
}
