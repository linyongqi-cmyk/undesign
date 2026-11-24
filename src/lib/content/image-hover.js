// These settings belong to plain images only, never to carousel slides.
export function imageHoverSettings(value) {
  const scale = Number(value?.scale);
  return {
    enabled: value?.enabled === true,
    scale: Number.isFinite(scale) ? Math.min(2.5, Math.max(1.1, scale)) : 1.5,
    origin: ['left', 'center', 'right'].includes(value?.origin) ? value.origin : 'left',
  };
}

export function imageHoverFields(image) {
  return image?.hoverZoom ? { hoverZoom: imageHoverSettings(image.hoverZoom) } : {};
}

export function imageHoverAttributes(image) {
  const settings = imageHoverSettings(image?.hoverZoom);
  return settings.enabled ? {
    'data-image-hover': '',
    'data-image-hover-scale': settings.scale,
    'data-image-hover-origin': settings.origin,
  } : {};
}
