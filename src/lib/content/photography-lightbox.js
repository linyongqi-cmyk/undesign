import { sortPhotographyGalleryVisualOrder } from './photography-gallery-layout.js';

let activePhotographyLightbox = null;

export function nextPhotographyImageIndex(index, direction, count) {
  if (!Number.isInteger(count) || count <= 1) return 0;
  return ((Math.trunc(index) + Math.sign(direction) + count) % count + count) % count;
}

function resolveImageUrl(src, baseUrl) {
  if (/^(?:blob:|data:|https?:\/\/|\/\/)/i.test(src)) return src;
  return `${baseUrl}${String(src || '').replace(/^\/+/, '')}`;
}

function descriptionText(value) {
  return typeof value === 'string' && value.trim() ? value : '';
}

function measureFrame(item, selector) {
  const element = item.element;
  const frame = element?.matches?.(selector) ? element : element?.querySelector?.(selector);
  if (!frame) return null;
  const rect = frame.getBoundingClientRect();
  return { top: rect.top, left: rect.left };
}

function visualOrder(items, selector) {
  const positions = items.map((item) => {
    const position = measureFrame(item, selector);
    return position ? { id: item.id, ...position } : null;
  }).filter(Boolean);
  const orderedIds = sortPhotographyGalleryVisualOrder(positions);
  return orderedIds.length === items.length ? orderedIds : items.map((item) => item.id);
}

function applyTextStyle(element, style = {}) {
  for (const [name, value] of Object.entries(style)) {
    if (name.startsWith('--') && ['string', 'number'].includes(typeof value)) element.style.setProperty(name, String(value));
  }
}

/** @param {{items?: Array<{id?: string, src: string, alt?: string, aspect?: number, cropAspect?: number, cropScale?: number, cropPosition?: string, photographyDescription?: string, element?: HTMLElement}>, startId?: string, baseUrl?: string, descriptionStyle?: Record<string, string | number>, returnFocus?: HTMLElement, frameSelector?: string}} options */
export function openPhotographyLightbox({
  items: sourceItems = [], startId, baseUrl = '/', descriptionStyle = {}, returnFocus, frameSelector,
}) {
  if (typeof document === 'undefined' || !Array.isArray(sourceItems) || !sourceItems.length) return null;
  activePhotographyLightbox?.close();

  const items = sourceItems.map((image, index) => ({
    ...image,
    id: String(image.id ?? `photography-image-${index}`),
  }));
  const orderedIds = visualOrder(items, frameSelector || '.photography-detail-image');
  const byId = new Map(items.map((item) => [item.id, item]));
  const orderedItems = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  let currentIndex = Math.max(0, orderedItems.findIndex((item) => item.id === String(startId)));
  let descriptionExpanded = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'photography-lightbox';
  dialog.dataset.photographyLightbox = '';
  dialog.setAttribute('aria-label', '摄影图集放大预览');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'photography-lightbox-close';
  closeButton.setAttribute('aria-label', '关闭图片预览');
  closeButton.textContent = '×';
  const stage = document.createElement('div');
  stage.className = 'photography-lightbox-stage';
  const layout = document.createElement('div');
  layout.className = 'photography-lightbox-layout';
  const frame = document.createElement('div');
  frame.className = 'photography-lightbox-frame';
  const caption = document.createElement('div');
  caption.className = 'photography-lightbox-caption';
  const captionRow = document.createElement('div');
  captionRow.className = 'photography-lightbox-caption-row';
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'photography-lightbox-image-button';
  nextButton.setAttribute('aria-label', '查看下一张图片');
  const image = document.createElement('img');
  image.className = 'photography-lightbox-image';
  image.alt = '';
  const loading = document.createElement('span');
  loading.className = 'photography-lightbox-loading';
  loading.setAttribute('role', 'status');
  loading.textContent = '加载中…';
  const description = document.createElement('p');
  description.className = 'photography-lightbox-description text-style-paragraph';
  description.hidden = true;
  description.tabIndex = 0;
  description.id = 'photography-lightbox-description';
  applyTextStyle(description, descriptionStyle);
  const descriptionToggle = document.createElement('button');
  descriptionToggle.type = 'button';
  descriptionToggle.className = 'photography-lightbox-description-toggle';
  descriptionToggle.setAttribute('aria-label', '显示摄影说明');
  descriptionToggle.setAttribute('aria-controls', description.id);
  descriptionToggle.setAttribute('aria-expanded', 'false');
  descriptionToggle.title = '显示摄影说明';
  const descriptionIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  descriptionIcon.setAttribute('viewBox', '0 0 24 24');
  descriptionIcon.setAttribute('aria-hidden', 'true');
  const descriptionArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  descriptionArrow.setAttribute('d', 'M6 9l6 6 6-6');
  descriptionIcon.append(descriptionArrow);
  descriptionToggle.append(descriptionIcon);
  descriptionToggle.hidden = true;
  const loadError = document.createElement('span');
  loadError.className = 'photography-lightbox-error';
  loadError.setAttribute('role', 'status');
  loadError.hidden = true;
  frame.append(nextButton, loading, loadError);
  nextButton.append(image);
  captionRow.append(descriptionToggle, description);
  caption.append(captionRow);
  layout.append(frame, caption);
  stage.append(layout);
  dialog.append(closeButton, stage);
  document.body.append(dialog);

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const previousHtmlOverflow = document.documentElement.style.overflow;
  const previousBodyOverflow = document.body.style.overflow;
  let loadVersion = 0;
  let finished = false;
  let currentAspect = 1;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  const resizeFrame = (aspect) => {
    const ratio = Number(aspect) > 0 ? Number(aspect) : 1;
    currentAspect = ratio;
    const hasDescription = !descriptionToggle.hidden;
    const isMobile = window.innerWidth <= 720;
    const descriptionWidth = isMobile ? '100%' : ratio > 1 ? '50%' : 'calc(100% - 24px)';
    const maxWidth = Math.max(120, window.innerWidth - 32);
    let width = Math.min(maxWidth, Math.min(window.innerHeight * 0.7, window.innerHeight - 76) * ratio);
    const measureDescriptionHeight = (measureWidth) => {
      if (!hasDescription) return 0;
      const wasHidden = description.hidden;
      const previousVisibility = description.style.visibility;
      caption.style.width = `${measureWidth}px`;
      captionRow.style.width = descriptionWidth;
      description.hidden = false;
      description.style.visibility = 'hidden';
      const measuredHeight = Math.min(description.getBoundingClientRect().height, window.innerHeight * 0.36);
      description.hidden = wasHidden;
      description.style.visibility = previousVisibility;
      return measuredHeight;
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const descriptionHeight = measureDescriptionHeight(width);
      const captionSpace = hasDescription ? 8 + Math.max(24, descriptionHeight) : 0;
      const maxHeight = Math.max(120, Math.min(window.innerHeight * 0.7, window.innerHeight - 76 - captionSpace));
      const nextWidth = Math.min(maxWidth, maxHeight * ratio);
      if (Math.abs(nextWidth - width) < 0.5) break;
      width = nextWidth;
    }
    frame.style.width = `${width}px`;
    frame.style.height = `${width / ratio}px`;
    caption.style.width = `${width}px`;
    captionRow.style.width = descriptionWidth;
  };

  const preloadNext = () => {
    if (orderedItems.length < 2) return;
    const next = orderedItems[nextPhotographyImageIndex(currentIndex, 1, orderedItems.length)];
    const preloaded = new Image();
    preloaded.src = resolveImageUrl(next.src, baseUrl);
  };

  const showCurrent = () => {
    const item = orderedItems[currentIndex];
    if (!item) return;
    loadVersion += 1;
    const version = loadVersion;
    const cropAspect = Number(item.cropAspect) > 0 ? Number(item.cropAspect) : 0;
    image.style.objectPosition = item.cropPosition || 'center';
    image.style.transform = `scale(${Number(item.cropScale) || 1})`;
    image.style.objectFit = cropAspect ? 'cover' : 'contain';
    image.style.opacity = '0';
    image.alt = item.alt || '';
    image.removeAttribute('src');
    loading.hidden = false;
    loadError.hidden = true;
    description.textContent = descriptionText(item.photographyDescription);
    const hasDescription = Boolean(description.textContent);
    const isDescriptionExpanded = hasDescription && descriptionExpanded;
    description.hidden = !isDescriptionExpanded;
    descriptionToggle.hidden = !hasDescription;
    descriptionToggle.setAttribute('aria-expanded', String(isDescriptionExpanded));
    descriptionToggle.setAttribute('aria-label', isDescriptionExpanded ? '隐藏摄影说明' : '显示摄影说明');
    descriptionToggle.title = isDescriptionExpanded ? '隐藏摄影说明' : '显示摄影说明';
    descriptionArrow.setAttribute('d', isDescriptionExpanded ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6');
    resizeFrame(cropAspect || item.aspect);
    nextButton.setAttribute('aria-label', orderedItems.length > 1 ? '查看下一张图片' : '当前图片');
    image.onload = () => {
      if (version !== loadVersion) return;
      if (!cropAspect && image.naturalWidth && image.naturalHeight) resizeFrame(image.naturalWidth / image.naturalHeight);
      loading.hidden = true;
      image.style.opacity = '1';
    };
    image.onerror = () => {
      if (version !== loadVersion) return;
      loading.hidden = true;
      loadError.textContent = '图片加载失败';
      loadError.hidden = false;
    };
    image.src = resolveImageUrl(item.src, baseUrl);
    preloadNext();
  };

  const relayout = () => {
    const currentId = orderedItems[currentIndex]?.id;
    const nextIds = visualOrder(items, frameSelector || '.photography-detail-image');
    const nextItems = nextIds.map((id) => byId.get(id)).filter(Boolean);
    orderedItems.splice(0, orderedItems.length, ...nextItems);
    currentIndex = Math.max(0, orderedItems.findIndex((item) => item.id === currentId));
    resizeFrame(currentAspect || orderedItems[currentIndex]?.cropAspect || orderedItems[currentIndex]?.aspect || (image.naturalWidth / image.naturalHeight));
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    if (activePhotographyLightbox?.dialog === dialog) activePhotographyLightbox = null;
    window.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', relayout);
    document.removeEventListener('astro:before-swap', finish);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('close', finish);
    dialog.close();
    dialog.remove();
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overflow = previousBodyOverflow;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    window.scrollTo(scrollX, scrollY);
  };
  const onKeydown = (event) => {
    if (!dialog.open || !['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === 'Escape') finish();
    else if (orderedItems.length > 1) {
      currentIndex = nextPhotographyImageIndex(currentIndex, event.key === 'ArrowRight' ? 1 : -1, orderedItems.length);
      showCurrent();
    }
  };
  const onCancel = (event) => { event.preventDefault(); finish(); };

  closeButton.addEventListener('click', finish);
  descriptionToggle.addEventListener('click', () => {
    if (descriptionToggle.hidden) return;
    descriptionExpanded = !descriptionExpanded;
    description.hidden = !descriptionExpanded;
    descriptionToggle.setAttribute('aria-expanded', String(descriptionExpanded));
    descriptionToggle.setAttribute('aria-label', descriptionExpanded ? '隐藏摄影说明' : '显示摄影说明');
    descriptionToggle.title = descriptionExpanded ? '隐藏摄影说明' : '显示摄影说明';
    descriptionArrow.setAttribute('d', descriptionExpanded ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6');
  });
  nextButton.addEventListener('click', () => {
    if (orderedItems.length <= 1) return;
    currentIndex = nextPhotographyImageIndex(currentIndex, 1, orderedItems.length);
    showCurrent();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || (event.target === stage && !frame.contains(event.target))) finish();
  });
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', finish);
  window.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', relayout, { passive: true });
  document.addEventListener('astro:before-swap', finish);
  dialog.showModal();
  activePhotographyLightbox = { dialog, close: finish };
  closeButton.focus({ preventScroll: true });
  showCurrent();
  return { close: finish, dialog };
}
