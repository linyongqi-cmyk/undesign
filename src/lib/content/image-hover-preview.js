import { imageHoverSettings } from './image-hover.js';

let activePreview;
let activeHoverContains;

// Render outside layout/crop containers; the original image keeps its layout size.
export function showImageHover(frame, value, { interactive = false } = {}) {
  const settings = imageHoverSettings(value);
  const image = frame?.querySelector('img');
  if (!image?.complete || !image.naturalWidth || !settings.enabled) return () => {};
  activePreview?.();
  const rect = frame.getBoundingClientRect();
  if (!rect.width || !rect.height) return () => {};
  const edge = 8;
  const scale = Math.min(settings.scale, (window.innerWidth - edge * 2) / rect.width, Math.max(1.1, (window.innerHeight - edge * 2) / rect.height));
  // An image already filling the viewport should not shrink on hover.
  if (scale <= 1) return () => {};
  const origin = { left: 0, center: 0.5, right: 1 }[settings.origin];
  const width = rect.width * scale;
  const height = rect.height * scale;
  const naturalLeft = rect.left - (width - rect.width) * origin;
  const naturalTop = rect.top - (height - rect.height) / 2;
  const left = Math.max(edge, Math.min(naturalLeft, window.innerWidth - edge - width));
  const top = Math.max(edge, Math.min(naturalTop, window.innerHeight - edge - height));
  const style = getComputedStyle(image);
  const layer = document.createElement('div');
  layer.dataset.imageHoverLayer = '';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', padding: '0',
    overflow: 'hidden', pointerEvents: 'none', zIndex: '10000',
    transformOrigin: `${origin * 100}% 50%`, boxShadow: '0 4px 16px rgb(0 0 0 / 14%)',
  });
  const copy = document.createElement('img');
  copy.src = image.currentSrc || image.src;
  copy.alt = '';
  copy.draggable = false;
  Object.assign(copy.style, {
    display: 'block', width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none',
    margin: '0', padding: '0', objectFit: style.objectFit, objectPosition: style.objectPosition,
    transform: style.transform, transformOrigin: 'center', filter: style.filter,
  });
  layer.append(copy);
  // The label is part of the enlarged viewport: it scales with the image and
  // stays clickable. It is not keyboard-focusable here (the original link is),
  // so there is no duplicate tab stop inside the aria-hidden layer.
  const label = frame.querySelector('[data-image-link-label]');
  if (label) {
    const labelCopy = label.cloneNode(true);
    labelCopy.setAttribute('aria-hidden', 'true');
    labelCopy.setAttribute('tabindex', '-1');
    labelCopy.style.pointerEvents = 'auto';
    layer.append(labelCopy);
  }
  document.body.append(layer);
  const transform = `translate(${left - naturalLeft}px, ${top - naturalTop}px) scale(${scale})`;
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
  const easing = 'cubic-bezier(1, 0, 0, 1)';
  layer.style.transform = transform;
  let animation = layer.animate([{ transform: 'none' }, { transform }], { duration, easing });
  let closed = false;
  const close = (immediate = false) => {
    if (closed) return;
    closed = true;
    if (activePreview === close) {
      activePreview = undefined;
      activeHoverContains = undefined;
    }
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('pointerout', leaveWindow, true);
    document.removeEventListener('keydown', key);
    document.removeEventListener('scroll', closeNow, true);
    window.removeEventListener('resize', closeNow);
    window.removeEventListener('blur', closeNow);
    window.removeEventListener('pagehide', closeNow);
    document.removeEventListener('astro:before-swap', closeNow);
    const from = getComputedStyle(layer).transform;
    animation.cancel();
    if (immediate || !duration) return layer.remove();
    animation = layer.animate([{ transform: from }, { transform: 'none' }], { duration, easing });
    animation.onfinish = () => layer.remove();
  };
  const closeNow = () => close(true);
  const pointerDown = (event) => {
    if (interactive && layer.contains(event.target)) return;
    closeNow();
  };
  layer.addEventListener('click', (event) => {
    // A real click on the enlarged label must reach its href untouched.
    if (event.target.closest?.('[data-image-link-label]')) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  const contains = (event) => frame.isConnected
    && event.clientX >= left && event.clientX <= left + width
    && event.clientY >= top && event.clientY <= top + height;
  const move = (event) => {
    if (!contains(event)) close();
  };
  const leaveWindow = (event) => { if (!event.relatedTarget) close(); };
  const key = (event) => { if (event.key === 'Escape') close(); };
  if (interactive) document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerdown', pointerDown, true);
  document.addEventListener('pointerout', leaveWindow, true);
  document.addEventListener('keydown', key);
  document.addEventListener('scroll', closeNow, true);
  window.addEventListener('resize', closeNow);
  window.addEventListener('blur', closeNow);
  window.addEventListener('pagehide', closeNow);
  document.addEventListener('astro:before-swap', closeNow);
  // Pointer transitions animate out; the returned disposer still removes immediately.
  activePreview = close;
  activeHoverContains = interactive ? contains : undefined;
  return closeNow;
}

export function bindImageHover() {
  const mouse = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)');
  let currentFrame;
  const detect = (event) => {
    if (!mouse.matches || event.pointerType !== 'mouse') return;
    // The visible enlarged image owns its entire area, including covered neighbors.
    // Only hit-test the underlying images after the pointer leaves that area.
    if (activeHoverContains?.(event)) return;
    const frame = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-image-hover]');
    if (frame === currentFrame && activePreview) return;
    if (currentFrame) activePreview?.();
    currentFrame = frame;
    if (frame) showImageHover(frame, { enabled: true, scale: frame.dataset.imageHoverScale, origin: frame.dataset.imageHoverOrigin }, { interactive: true });
  };
  document.addEventListener('pointerover', detect);
  document.addEventListener('pointermove', detect);
  mouse.addEventListener('change', () => { activePreview?.(); currentFrame = undefined; });
}
