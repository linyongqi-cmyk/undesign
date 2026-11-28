import { workThumbnail, thumbnailImageStyle } from '../content/work-thumbnail.js';
import { showEditorFeedback } from './editor-feedback.js';
import { adminActionIcon } from './action-icons.js';
let activeDialog;

const cropRatios = [[1, 1], [4, 3], [3, 2], [5, 4], [16, 9]];
const ratioOptions = (ratios) => ratios.map(([width, height]) =>
  `<option value="${width / height}">${width}:${height}</option>`
).join('');

function parsePosition(value = 'center') {
  const parts = value.split(/\s+/);
  const number = (part) => {
    const parsed = Number.parseFloat(part);
    return Number.isFinite(parsed) ? parsed : 50;
  };
  return [number(parts[0]), number(parts[1] || parts[0])];
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function ensureDialog() {
  if (activeDialog) return activeDialog;
  const dialog = document.createElement('dialog');
  dialog.className = 'image-crop-dialog';
  dialog.innerHTML = `<div class="image-crop-shell"><div class="image-crop-stage"><img class="image-crop-source" alt="" draggable="false"><div class="image-crop-box" role="slider" aria-label="裁切区域"><i data-crop-handle="nw"></i><i data-crop-handle="ne"></i><i data-crop-handle="sw"></i><i data-crop-handle="se"></i></div></div><aside class="image-crop-side"><h2 id="image-crop-heading">图片裁切</h2><div class="image-crop-variants" role="tablist" aria-label="显示方向" hidden></div><label class="image-crop-ratio-control"><span>裁切比例<output class="image-crop-ratio" aria-live="polite"></output></span><select aria-label="裁切比例"><option value="free">自由比例</option><option value="original">原图比例</option>${ratioOptions(cropRatios.slice(0, 1))}<optgroup label="横向">${ratioOptions(cropRatios.slice(1))}</optgroup><optgroup label="纵向">${ratioOptions(cropRatios.slice(1).map(([width, height]) => [height, width]))}</optgroup></select></label><div class="image-crop-result"><img alt=""></div><label class="image-crop-zoom"><span>裁切范围</span><input type="range" min="1" max="4" step="0.01" value="1"></label></aside><footer class="image-crop-actions"><button type="button" class="button button-quiet admin-icon-button" data-crop-cancel aria-label="取消" title="取消">${adminActionIcon('close')}</button><button type="button" class="button button-dark admin-icon-button" data-crop-confirm aria-label="保存" title="保存">${adminActionIcon('save')}</button></footer></div>`;
  dialog.setAttribute('aria-labelledby', 'image-crop-heading');
  document.body.append(dialog);
  activeDialog = dialog;
  return dialog;
}

export function openImageCropEditor({ src, aspect = 1, scale = 1, position = 'center', fixedAspect = false, preserveCenter = false, center, variants, onConfirm }) {
  if (!src) return;
  const dialog = ensureDialog();
  const stage = dialog.querySelector('.image-crop-stage');
  const source = dialog.querySelector('.image-crop-source');
  const box = dialog.querySelector('.image-crop-box');
  const preview = dialog.querySelector('.image-crop-result');
  const previewImage = preview.querySelector('img');
  const zoom = dialog.querySelector('input[type="range"]');
  const ratioText = dialog.querySelector('.image-crop-ratio');
  const ratioControl = dialog.querySelector('.image-crop-ratio-control');
  const ratioSelect = ratioControl.querySelector('select');
  const variantsBar = dialog.querySelector('.image-crop-variants');
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  const variantStates = hasVariants ? new Map(variants.map((item) => [item.id, {
    id: item.id,
    label: item.label,
    aspect: Number(item.aspect) || 1,
    scale: Number(item.scale) || 1,
    position: item.position || 'center',
    fixedAspect: item.fixedAspect !== false,
  }])) : null;
  let activeVariant = hasVariants ? variants[0].id : null;
  const initialVariant = hasVariants ? variantStates.get(activeVariant) : null;
  let currentScale = initialVariant ? initialVariant.scale : scale;
  let currentPosition = initialVariant ? initialVariant.position : position;
  let isFixedAspect = initialVariant ? initialVariant.fixedAspect : fixedAspect;
  ratioSelect.disabled = isFixedAspect;
  ratioControl.hidden = hasVariants;
  let selectedAspect = initialVariant ? initialVariant.aspect : (Number(aspect) || 1);
  const bounds = { x: 0, y: 0, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 };
  let rect = null;
  let pointer = null;

  dialog.dataset.aspect = String(selectedAspect);
  const sourceUrl = /^(?:blob:|data:|https?:\/\/)/i.test(src) ? src : `/${src.replace(/^\//, '')}`;
  source.src = sourceUrl;
  previewImage.removeAttribute('style');
  previewImage.src = sourceUrl;
  preview.style.position = 'relative';
  zoom.value = String(Math.max(1, Math.min(4, Number(currentScale) || 1)));
  preview.style.aspectRatio = `${selectedAspect} / 1`;
  previewImage.style.objectPosition = currentPosition || 'center';

  const renderVariants = () => {
    if (!hasVariants) {
      variantsBar.hidden = true;
      variantsBar.replaceChildren();
      return;
    }
    variantsBar.hidden = false;
    const buttons = [];
    for (const item of variantStates.values()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'image-crop-variant-button';
      button.role = 'tab';
      button.dataset.cropVariant = item.id;
      button.setAttribute('aria-selected', String(item.id === activeVariant));
      button.textContent = item.label;
      buttons.push(button);
    }
    variantsBar.replaceChildren(...buttons);
  };
  renderVariants();

  const getCropValues = () => {
    const factor = bounds.width / bounds.naturalWidth;
    const cropWidth = rect.width / factor;
    const cropHeight = rect.height / factor;
    const cropX = (rect.x - bounds.x) / factor;
    const cropY = (rect.y - bounds.y) / factor;
    const cropScale = Math.max(1, Math.min(4, Math.min(bounds.width, bounds.height * selectedAspect) / rect.width));
    const cover = Math.max(selectedAspect / bounds.naturalWidth, 1 / bounds.naturalHeight);
    const renderedWidth = bounds.naturalWidth * cover;
    const renderedHeight = bounds.naturalHeight * cover;
    // CSS object-position percentages are allowed outside 0–100%. Those values
    // are necessary when a zoomed crop touches an image edge: clamping them
    // shifts the final cover away from the crop box shown in this editor.
    const positionX = Math.abs(selectedAspect - renderedWidth) < 0.0001 ? 50 : ((selectedAspect / 2 - selectedAspect / (2 * cropScale) - cropX * cover) / (selectedAspect - renderedWidth)) * 100;
    const positionY = Math.abs(1 - renderedHeight) < 0.0001 ? 50 : ((0.5 - 0.5 / cropScale - cropY * cover) / (1 - renderedHeight)) * 100;
    return {
      scale: cropScale,
      position: `${positionX.toFixed(2)}% ${positionY.toFixed(2)}%`,
      aspect: selectedAspect,
      cropWidth,
      cropHeight,
      centerX: (cropX + cropWidth / 2) / bounds.naturalWidth,
      centerY: (cropY + cropHeight / 2) / bounds.naturalHeight,
    };
  };
  const updatePreview = () => {
    if (!rect) return;
    if (ratioSelect.value === 'free') selectedAspect = rect.width / rect.height;
    preview.style.aspectRatio = `${selectedAspect} / 1`;
    const values = getCropValues();
    zoom.value = String(values.scale);
    previewImage.style.objectPosition = values.position;
    previewImage.style.transform = `scale(${values.scale})`;
    if (preserveCenter) Object.assign(previewImage.style, thumbnailImageStyle(workThumbnail({ masonryThumbnail: values }, 'masonry', bounds.naturalWidth / bounds.naturalHeight)));
    ratioText.textContent = `${selectedAspect.toFixed(2).replace(/\.00$/, '')}:1`;
    // rect and bounds use stage-local coordinates. Do not subtract the
    // centered image offset here or the visible crop frame drifts left/up.
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  };

  const resizeStage = () => {
    const stageRect = stage.getBoundingClientRect();
    const factor = Math.min(stageRect.width / source.naturalWidth, stageRect.height / source.naturalHeight);
    bounds.naturalWidth = source.naturalWidth;
    bounds.naturalHeight = source.naturalHeight;
    bounds.width = source.naturalWidth * factor;
    bounds.height = source.naturalHeight * factor;
    bounds.x = (stageRect.width - bounds.width) / 2;
    bounds.y = (stageRect.height - bounds.height) / 2;
    source.style.width = `${bounds.width}px`;
    source.style.height = `${bounds.height}px`;
    source.style.left = `${bounds.x}px`;
    source.style.top = `${bounds.y}px`;
    const maxWidth = Math.min(bounds.width, bounds.height * selectedAspect);
    const cropScale = clamp(Number(currentScale) || 1, 1, 4);
    const width = maxWidth / cropScale;
    const height = width / selectedAspect;
    const cover = Math.max(selectedAspect / bounds.naturalWidth, 1 / bounds.naturalHeight);
    const renderedWidth = bounds.naturalWidth * cover;
    const renderedHeight = bounds.naturalHeight * cover;
    const [px, py] = parsePosition(currentPosition);
    const cropX = (selectedAspect / 2 - selectedAspect / (2 * cropScale) - (px / 100) * (selectedAspect - renderedWidth)) / cover;
    const cropY = (0.5 - 0.5 / cropScale - (py / 100) * (1 - renderedHeight)) / cover;
    rect = {
      width, height,
      x: bounds.x + (preserveCenter && Number.isFinite(center?.centerX) ? center.centerX * bounds.width - width / 2 : cropX * factor),
      y: bounds.y + (preserveCenter && Number.isFinite(center?.centerY) ? center.centerY * bounds.height - height / 2 : cropY * factor),
    };
    rect.x = clamp(rect.x, bounds.x, bounds.x + bounds.width - width);
    rect.y = clamp(rect.y, bounds.y, bounds.y + bounds.height - height);
    updatePreview();
  };

  const onPointerDown = (event) => {
    if (!rect || !event.target.closest('.image-crop-box')) return;
    event.preventDefault();
    const handle = event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
    pointer = { mode: handle || 'move', x: event.clientX, y: event.clientY, rect: { ...rect } };
    box.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const start = pointer.rect;
    if (pointer.mode === 'move') {
      rect.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - rect.width, start.x + dx));
      rect.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - rect.height, start.y + dy));
    } else if (ratioSelect.value === 'free') {
      const west = pointer.mode.includes('w');
      const north = pointer.mode.includes('n');
      const anchorX = west ? start.x + start.width : start.x;
      const anchorY = north ? start.y + start.height : start.y;
      const maxWidth = west ? anchorX - bounds.x : bounds.x + bounds.width - anchorX;
      const maxHeight = north ? anchorY - bounds.y : bounds.y + bounds.height - anchorY;
      const width = clamp(start.width + (west ? -dx : dx), Math.min(24, maxWidth), maxWidth);
      const height = clamp(start.height + (north ? -dy : dy), Math.min(24, maxHeight), maxHeight);
      const minimumScaleFraction = 1 / Number(zoom.max);
      rect.width = width;
      rect.height = height;
      if (width < bounds.width * minimumScaleFraction && height < bounds.height * minimumScaleFraction) {
        if (width / bounds.width >= height / bounds.height && maxWidth >= bounds.width * minimumScaleFraction) {
          rect.width = bounds.width * minimumScaleFraction;
        } else if (maxHeight >= bounds.height * minimumScaleFraction) {
          rect.height = bounds.height * minimumScaleFraction;
        } else {
          rect.width = Math.min(maxWidth, bounds.width * minimumScaleFraction);
        }
      }
      rect.x = west ? anchorX - rect.width : anchorX;
      rect.y = north ? anchorY - rect.height : anchorY;
    } else {
      const directionX = pointer.mode.includes('w') ? -1 : 1;
      const directionY = pointer.mode.includes('n') ? -1 : 1;
      const delta = Math.abs(dx) > Math.abs(dy * selectedAspect) ? dx * directionX : dy * directionY * selectedAspect;
      const maxWidth = Math.min(bounds.width, bounds.height * selectedAspect);
      const width = Math.max(Math.min(54, maxWidth), Math.min(maxWidth, start.width + delta));
      const height = width / selectedAspect;
      rect.x = pointer.mode.includes('w') ? start.x + start.width - width : start.x;
      rect.y = pointer.mode.includes('n') ? start.y + start.height - height : start.y;
      rect.width = width;
      rect.height = height;
      rect.x = clamp(rect.x, bounds.x, bounds.x + bounds.width - width);
      rect.y = clamp(rect.y, bounds.y, bounds.y + bounds.height - height);
    }
    updatePreview();
  };
  const onPointerUp = () => { pointer = null; };
  const onZoom = () => {
    if (!rect) return;
    const maxWidth = Math.min(bounds.width, bounds.height * selectedAspect);
    const width = maxWidth / Number(zoom.value);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    rect.width = width;
    rect.height = width / selectedAspect;
    rect.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - width, centerX - width / 2));
    rect.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - rect.height, centerY - rect.height / 2));
    updatePreview();
  };
  let onDialogCancel;
  const onAspectChange = () => {
    if (ratioSelect.value === 'free') {
      updatePreview();
      return;
    }
    selectedAspect = ratioSelect.value === 'original' ? source.naturalWidth / source.naturalHeight : Number(ratioSelect.value);
    if (!Number.isFinite(selectedAspect) || selectedAspect <= 0) selectedAspect = 1;
    dialog.dataset.aspect = String(selectedAspect);
    preview.style.aspectRatio = `${selectedAspect} / 1`;
    if (source.complete && source.naturalWidth) resizeStage();
  };
  const onVariantClick = (event) => {
    const button = event.target.closest('[data-crop-variant]');
    if (!button || !variantStates) return;
    const nextId = button.dataset.cropVariant;
    if (!nextId || nextId === activeVariant || !variantStates.has(nextId)) return;
    if (rect) {
      const current = getCropValues();
      const prev = variantStates.get(activeVariant);
      variantStates.set(activeVariant, { ...prev, scale: current.scale, position: current.position, aspect: current.aspect });
    }
    activeVariant = nextId;
    const target = variantStates.get(nextId);
    selectedAspect = target.aspect;
    currentScale = target.scale;
    currentPosition = target.position;
    isFixedAspect = target.fixedAspect;
    ratioSelect.disabled = isFixedAspect;
    dialog.dataset.aspect = String(selectedAspect);
    preview.style.aspectRatio = `${selectedAspect} / 1`;
    renderVariants();
    if (source.complete && source.naturalWidth) resizeStage();
  };
  const cleanup = () => {
    source.removeEventListener('load', resizeStage);
    box.removeEventListener('pointerdown', onPointerDown);
    box.removeEventListener('pointermove', onPointerMove);
    box.removeEventListener('pointerup', onPointerUp);
    box.removeEventListener('pointercancel', onPointerUp);
    zoom.removeEventListener('input', onZoom);
    ratioSelect.removeEventListener('change', onAspectChange);
    variantsBar.removeEventListener('click', onVariantClick);
    dialog.querySelector('[data-crop-confirm]').removeEventListener('click', confirm);
    dialog.querySelector('[data-crop-cancel]').removeEventListener('click', cancel);
    if (onDialogCancel) dialog.removeEventListener('cancel', onDialogCancel);
  };
  const confirm = async () => {
    if (!rect) return;
    const button = dialog.querySelector('[data-crop-confirm]');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = '应用中…';
    button.setAttribute('aria-busy', 'true');
    const values = getCropValues();
    const factor = bounds.naturalWidth / bounds.width;
    const x = (rect.x - bounds.x) * factor;
    const y = (rect.y - bounds.y) * factor;
    const exportCrop = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(values.cropWidth));
      canvas.height = Math.max(1, Math.round(values.cropHeight));
      canvas.getContext('2d').drawImage(source, x, y, values.cropWidth, values.cropHeight, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('无法生成裁切图片');
      return new File([blob], 'cropped-image.png', { type: 'image/png' });
    };
    try {
      if (variantStates && activeVariant) {
        const prev = variantStates.get(activeVariant);
        variantStates.set(activeVariant, { ...prev, scale: values.scale, position: values.position, aspect: values.aspect });
      }
      await onConfirm?.({ scale: values.scale, position: values.position, aspect: values.aspect, centerX: values.centerX, centerY: values.centerY, originalAspect: ratioSelect.value === 'original' || Math.abs(values.aspect - source.naturalWidth / source.naturalHeight) < 0.0001, variants: variantStates ? Object.fromEntries(variantStates) : undefined, activeVariant, exportCrop });
      cleanup();
      dialog.close();
      showEditorFeedback('图片裁切已应用');
    } catch (error) {
      ratioText.textContent = error.message || '保存裁切失败';
    } finally {
      button.disabled = false;
      button.textContent = '应用';
      button.removeAttribute('aria-busy');
    }
  };
  const cancel = () => {
    if (dialog.querySelector('[data-crop-confirm]').disabled) return;
    cleanup();
    dialog.close();
  };
  onDialogCancel = (event) => { event.preventDefault(); cancel(); };

  box.addEventListener('pointerdown', onPointerDown);
  box.addEventListener('pointermove', onPointerMove);
  box.addEventListener('pointerup', onPointerUp);
  box.addEventListener('pointercancel', onPointerUp);
  zoom.addEventListener('input', onZoom);
  ratioSelect.querySelector('[data-fixed-ratio]')?.remove();
  if (isFixedAspect && ![...ratioSelect.options].some(({ value }) => Math.abs(Number(value) - selectedAspect) < 0.0001)) {
    const option = new Option('固定比例', String(selectedAspect));
    option.dataset.fixedRatio = '';
    ratioSelect.append(option);
  }
  ratioSelect.value = [...ratioSelect.options].find(({ value }) => Math.abs(Number(value) - selectedAspect) < 0.0001)?.value || 'free';
  ratioSelect.addEventListener('change', onAspectChange);
  variantsBar.addEventListener('click', onVariantClick);
  dialog.querySelector('[data-crop-confirm]').addEventListener('click', confirm);
  dialog.querySelector('[data-crop-cancel]').addEventListener('click', cancel);
  dialog.addEventListener('cancel', onDialogCancel);
  if (!dialog.open) dialog.showModal();
  if (source.complete && source.naturalWidth) requestAnimationFrame(resizeStage);
  else source.addEventListener('load', resizeStage, { once: true });
}
