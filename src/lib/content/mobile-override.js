// Shared mobile override helpers for front-end rendering, Puck conversion, and validation.

export const MOBILE_LAYOUT_MODES = ['stack', 'keep', 'columns2', 'scroll'];
export const MOBILE_ALIGNS = ['left', 'center', 'right'];

export function normalizeMobileOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const next = {};
  if (value.hidden === true) next.hidden = true;
  if (Number.isInteger(value.displayWidth) && value.displayWidth >= 10 && value.displayWidth <= 100) {
    next.displayWidth = value.displayWidth;
  }
  if (value.align === 'center' || value.align === 'right' || (value.align === 'left' && next.displayWidth !== undefined && next.displayWidth < 100)) {
    next.align = value.align;
  }
  if (typeof value.layout === 'string' && value.layout !== 'stack' && MOBILE_LAYOUT_MODES.includes(value.layout)) {
    next.layout = value.layout;
  }
  return Object.keys(next).length ? next : undefined;
}

export function hasMobileOverride(value) {
  return Boolean(normalizeMobileOverride(value));
}

export function hasMobileImageCrop(image) {
  if (!image || typeof image !== 'object') return false;
  return Boolean(
    (Number.isFinite(Number(image.mobileCropAspect)) && Number(image.mobileCropAspect) > 0)
    || image.mobileCropScale !== undefined
    || image.mobileCropPosition !== undefined,
  );
}

export function mobileWrapProps(mobile) {
  const normalized = normalizeMobileOverride(mobile);
  if (!normalized) {
    return { active: false, hidden: false, width: undefined, align: undefined, attrs: {}, style: undefined };
  }
  const hidden = normalized.hidden === true;
  const width = normalized.displayWidth;
  const align = normalized.align;
  const active = Boolean(hidden || width !== undefined || align !== undefined);
  const attrs = {
    ...(hidden ? { 'data-mobile-hidden': '' } : {}),
    ...(width !== undefined ? { 'data-mobile-width': String(width) } : {}),
    ...(align !== undefined ? { 'data-mobile-align': align } : {}),
  };
  const style = width !== undefined ? `--mobile-display-width:${width}%` : undefined;
  return { active, hidden, width, align, attrs, style };
}

export function imageCropMobileAttrs(image) {
  if (!hasMobileImageCrop(image)) return { attrs: {}, styleFragment: '' };
  const aspect = Number(image.mobileCropAspect);
  const hasAspect = Number.isFinite(aspect) && aspect > 0;
  const scale = Number(image.mobileCropScale);
  const resolvedScale = Number.isFinite(scale) && scale > 0 ? scale : Number(image.cropScale) || 1;
  const position = typeof image.mobileCropPosition === 'string' && image.mobileCropPosition.trim()
    ? image.mobileCropPosition
    : (image.cropPosition || 'center');
  const styleParts = [
    ...(hasAspect ? [`--mobile-crop-aspect:${aspect} / 1`] : []),
    `--mobile-crop-position:${position}`,
    `--mobile-crop-scale:${resolvedScale}`,
  ];
  return {
    attrs: { 'data-mobile-crop': hasAspect ? 'cover' : 'contain' },
    styleFragment: styleParts.join(';'),
  };
}
