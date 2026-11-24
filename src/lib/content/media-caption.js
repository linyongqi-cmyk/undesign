// Shared rules for media text. The front end, the local editor and the Puck
// conversions all read captions and image link labels through this module so a
// single default, unit and validation rule applies to every media component.
import { validExternalUrl } from './free-media.js';
import { imageHoverFields } from './image-hover.js';

export const mediaCaptionDefaultGap = 4;
export const mediaCaptionMinGap = 0;
export const mediaCaptionMaxGap = 120;

const clampGap = (value) => Math.min(mediaCaptionMaxGap, Math.max(mediaCaptionMinGap, Math.round(value)));

export function mediaCaptionSettings(value) {
  const gap = Number(value?.gap);
  return {
    position: value?.position === 'top' ? 'top' : 'bottom',
    gap: Number.isFinite(gap) ? clampGap(gap) : mediaCaptionDefaultGap,
  };
}

// The caption rendered outside a media viewport; null when there is no text,
// so an empty caption leaves no blank space behind.
export function mediaCaption(source) {
  const text = typeof source?.caption === 'string' ? source.caption.trim() : '';
  if (!text) return null;
  return { text, ...mediaCaptionSettings(source?.captionSettings) };
}

// Persisted caption fields for one media item. The text stays in `caption`
// (legacy data already uses it); position and gap live in `captionSettings`
// and are only written when they differ from the defaults.
export function mediaCaptionFields(source) {
  const caption = typeof source?.caption === 'string' ? source.caption : '';
  const settings = mediaCaptionSettings(source?.captionSettings);
  return {
    caption,
    ...(source?.captionSettings !== undefined && (settings.position !== 'bottom' || settings.gap !== mediaCaptionDefaultGap) ? { captionSettings: settings } : {}),
  };
}

// A clickable label inside the visible image viewport. Invalid text or a
// non-HTTPS address removes the label instead of producing a broken link.
export function imageLinkLabel(image) {
  const text = typeof image?.linkLabel?.text === 'string' ? image.linkLabel.text.trim() : '';
  const href = validExternalUrl(image?.linkLabel?.href);
  if (!text || !href) return null;
  return { text, href, newTab: image.linkLabel.newTab !== false };
}

export function imageLinkFields(image) {
  const label = imageLinkLabel(image);
  return label ? { linkLabel: label } : {};
}

// One image's persisted fields, shared by every conversion path.
export function imageData(image) {
  if (!image || typeof image !== 'object') return { src: '', alt: '', caption: '' };
  return {
    src: image.src || '',
    alt: image.alt || '',
    ...(typeof image.photographyDescription === 'string' ? { photographyDescription: image.photographyDescription } : {}),
    ...mediaCaptionFields(image),
    ...imageLinkFields(image),
    ...(image.cropAspect ? { cropAspect: image.cropAspect } : {}),
    ...(image.cropScale ? { cropScale: image.cropScale } : {}),
    ...(image.cropPosition ? { cropPosition: image.cropPosition } : {}),
    ...(image.mobileCropAspect ? { mobileCropAspect: image.mobileCropAspect } : {}),
    ...(image.mobileCropScale ? { mobileCropScale: image.mobileCropScale } : {}),
    ...(image.mobileCropPosition ? { mobileCropPosition: image.mobileCropPosition } : {}),
    ...imageHoverFields(image),
  };
}
