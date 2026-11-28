import { showEditorFeedback, installEditorFeedback } from '../../src/lib/admin/editor-feedback.js';
import { createEditorHistory } from '../../src/lib/admin/editor-history.js';
import { adminActionIcon } from '../../src/lib/admin/action-icons.js';
import { biographyTextStyle } from '../../src/lib/content/biography-style.js';
import { focusParagraphEditor, pasteEditorText, readEditorParagraphs, writeEditorParagraphs } from '../../src/lib/admin/paragraph-editor.js';
import { loadContent, loadTrash, listImages, retainHistoryMedia, pruneOrphanImages, removeWork, restoreWork, renameWork, saveRecord, transferWork, uploadImage, uploadVideo, validateBatch, beginBatch, commitBatch, rollbackBatch } from './api.js';
import { renderCanvas } from './preview.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PuckTextStylePanel, PuckWorkEditor } from '../../src/components/admin/PuckWorkEditor.jsx';
import { puckDocumentToWork, workToPuckDocument } from '../../src/lib/admin/puck-work-document.js';
import { rewriteWorkLinks } from '../../src/lib/content/rewrite-work-links.js';
import { openImageCropEditor } from '../../src/lib/admin/image-crop-editor.js';

const $ = (selector) => document.querySelector(selector);
installEditorFeedback();
let puckRoot = null;
let biographyStyleRoot = null;
const state = {
  content: null,
  drafts: null,
  images: {},
  section: 'site',
  categorySlug: 'product',
  workSlug: 'lou',
  dirty: new Set(),
  workRenames: new Map(),
  workEditorRevision: 0,
  workIds: new Map(),
  puckDocuments: new Map(),
  busy: false,
  createKind: 'work',
  previewHomeCoverIndex: 0,
  homePreviewMode: 'desktop',
  bioLanguage: 'Ja',
};

let history = null;
let restoringHistory = false;
let composing = false;
let beforeInputFocus = null;
let savedSections = {};
const savedWorks = new Map();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ensureWorkId(key) {
  if (!state.workIds.has(key)) state.workIds.set(key, crypto.randomUUID());
  return state.workIds.get(key);
}
function historySnapshot() {
  const snapshot = { site: state.drafts.site, about: state.drafts.about, contact: state.drafts.contact };
  snapshot.categories = state.drafts.categories.map(({ works, ...category }) => ({ ...category,
    works: works.map((work) => ensureWorkId(workKey(category.slug, work.slug))),
  }));
  for (const [key, work] of Object.entries(state.drafts.works)) {
    const id = ensureWorkId(key);
    snapshot[`work:${id}`] = {
      work: { ...work, slug: state.workRenames.get(key) ?? work.slug },
      document: state.puckDocuments.get(id) ?? workToPuckDocument(work),
    };
  }
  return snapshot;
}
function historyView() {
  return { section: state.section, categorySlug: state.categorySlug,
    workId: state.workIds.get(workKey()), bioLanguage: state.bioLanguage };
}
function captureFocus() {
  const element = document.activeElement;
  if (!element?.matches('input:not([type="file"]), textarea, [contenteditable]')) return null;
  const component = element.closest('[data-puck-component]')?.getAttribute('data-puck-component');
  const attributes = ['data-history-field', 'data-path', 'data-edit-path', 'data-bio-copy', 'data-work-url-slug', 'aria-label', 'name'];
  const attribute = attributes.find((name) => element.hasAttribute(name));
  if (!attribute) return null;
  const selector = `${component ? `[data-puck-component="${CSS.escape(component)}"] ` : ''}[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
  if (element.isContentEditable) {
    const selection = document.getSelection();
    let offset = 0;
    if (selection?.rangeCount && element.contains(selection.focusNode)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.setEnd(selection.focusNode, selection.focusOffset);
      offset = range.toString().length;
    }
    const peers = component ? [...element.closest('[data-puck-component]').querySelectorAll('.puck-inline-editable, .puck-paragraph-editor, .puck-inline-textarea')] : [];
    return { selector, component, editorIndex: peers.indexOf(element), offset };
  }
  return { selector, start: element.selectionStart, end: element.selectionEnd };
}
function restoreFocus(focus) {
  if (!focus) return;
  let element = document.querySelector(focus.selector);
  if (!element && focus.component) element = document.querySelectorAll(`[data-puck-component="${CSS.escape(focus.component)}"] .puck-inline-editable`)[Math.max(0, focus.editorIndex ?? 0)];
  if (!element) return;
  if (element.matches('.js-edit-on-double-click') && !element.isContentEditable) beginCanvasEdit(element);
  if (!element.matches('input, textarea, [contenteditable]')) element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  requestAnimationFrame(() => {
    const input = document.querySelector(focus.selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (input.isContentEditable) {
      let remaining = focus.offset ?? 0;
      const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (remaining <= node.length) {
          const selection = document.getSelection();
          selection.setPosition(node, remaining);
          return;
        }
        remaining -= node.length;
      }
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
    } else if (focus.start !== null && input.setSelectionRange && !['number', 'email', 'range', 'checkbox', 'color'].includes(input.type)) {
      input.setSelectionRange(focus.start, focus.end);
    }
  });
}
function recordHistory() {
  if (!history || restoringHistory || state.busy) return;
  history.record(historySnapshot(), { view: historyView(), beforeFocus: beforeInputFocus, afterFocus: captureFocus() });
  if (!composing) beforeInputFocus = null;
  updateHistoryButtons();
}
function categoryMetadata() {
  return state.drafts.categories.map(({ works, ...category }, order) => ({ ...category, order }));
}
function recomputeDirty() {
  state.dirty.clear();
  for (const section of ['site', 'about', 'contact']) {
    if (!same(state.drafts[section], savedSections[section])) state.dirty.add(section);
  }
  if (!same(categoryMetadata(), savedSections.categories)) state.dirty.add('categories');
  for (const [key, work] of Object.entries(state.drafts.works)) {
    const saved = savedWorks.get(ensureWorkId(key));
    if (!saved?.work || !same(work, saved.work) || state.workRenames.has(key)) state.dirty.add(key);
    if (saved?.work && saved.category !== work.category) state.dirty.add(`move:${saved.category}:${saved.slug}`);
  }
  const present = new Set(Object.keys(state.drafts.works).map(ensureWorkId));
  for (const [id, saved] of savedWorks) if (saved.work && !present.has(id)) state.dirty.add(`deleted:${id}`);
}
function updateHistoryButtons() {
  const undo = $('#undo-button');
  const redo = $('#redo-button');
  if (!undo || !redo) return;
  undo.disabled = state.busy || !history?.canUndo;
  redo.disabled = state.busy || !history?.canRedo;
  undo.title = `撤回（⌘Z / Ctrl+Z） · ${history?.position ?? 0} 步可撤回`;
  redo.title = `重做（⌘⇧Z / Ctrl+Shift+Z） · ${(history?.length ?? 0) - (history?.position ?? 0)} 步可重做`;
}
function travelHistory(direction) {
  if (!history || state.busy || composing || document.querySelector('dialog[open]')) return;
  const result = direction === 'undo' ? history.undo() : history.redo();
  if (!result) return;
  const { snapshot, context } = result;
  restoringHistory = true;
  state.workRenames.clear();
  state.workIds.clear();
  state.puckDocuments.clear();
  const works = {};
  const byId = new Map();
  for (const [recordKey, record] of Object.entries(snapshot)) {
    if (!recordKey.startsWith('work:')) continue;
    const id = recordKey.slice(5);
    const work = record.work;
    const desiredSlug = work.slug;
    const saved = savedWorks.get(id);
    work.slug = saved?.slug ?? desiredSlug;
    const key = workKey(work.category, work.slug);
    works[key] = work;
    byId.set(id, work);
    state.workIds.set(key, id);
    state.puckDocuments.set(id, record.document);
    if (work.slug !== desiredSlug) state.workRenames.set(key, desiredSlug);
  }
  state.drafts = { site: snapshot.site, about: snapshot.about, contact: snapshot.contact, works,
    categories: snapshot.categories.map(({ works: ids, ...category }) => ({ ...category, works: ids.map((id) => byId.get(id)).filter(Boolean) })),
  };
  const view = context?.view;
  if (view) {
    state.section = view.section;
    state.categorySlug = view.categorySlug;
    state.bioLanguage = view.bioLanguage;
    const selected = byId.get(view.workId);
    if (selected) { state.categorySlug = selected.category; state.workSlug = selected.slug; }
  }
  if (!activeCategory()) state.categorySlug = state.drafts.categories[0]?.slug || '';
  if (!activeWork()) state.workSlug = activeCategory()?.works[0]?.slug || '';
  state.workEditorRevision += 1;
  recomputeDirty();
  renderEditor();
  restoringHistory = false;
  updateHistoryButtons();
  requestAnimationFrame(() => restoreFocus(direction === 'undo' ? context?.beforeFocus : context?.afterFocus));
  showEditorFeedback(direction === 'undo' ? '已撤回' : '已重做', { detail: state.dirty.size ? '修改已进入草稿，需保存到本机。' : '当前内容与本机保存一致。' });
}

const sectionLabels = { site: '首页与网站设置', about: '个人介绍', contact: '联系方式', categories: '作品分类与管理', work: '作品与详情页' };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function activeCategory() { return state.drafts.categories.find((category) => category.slug === state.categorySlug); }
function workKey(category = state.categorySlug, slug = state.workSlug) { return `work:${category}:${slug}`; }
function activeWork() { return state.drafts.works[workKey()]; }
function activeDraft() {
  if (state.section === 'work') return activeWork();
  if (state.section === 'categories') return state.drafts.categories;
  return state.drafts[state.section];
}
function activeDirtyKey() { return state.section === 'work' ? workKey() : state.section; }
function setPath(target, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((current, key) => current?.[Array.isArray(current) ? Number(key) : key], target);
  if (parent && last !== undefined) parent[Array.isArray(parent) ? Number(last) : last] = value;
}
function getPath(target, path) {
  if (!path) return target;
  return path.split('.').reduce((current, key) => current?.[Array.isArray(current) ? Number(key) : key], target);
}
function setDirty() {
  recordHistory();
  recomputeDirty();
  clearStatus();
}
function clearStatus() {
  updateHistoryButtons();
  $('#save-button').disabled = state.busy || !state.dirty.size;
}
function setError(message) {
  showEditorFeedback(message, { kind: 'error', detail: '操作未完成，请检查后重试。' });
}
function allImageGroups() { return ['home', 'about', ...state.drafts.categories.map((category) => `works/${category.slug}`)]; }
async function refreshImages() {
  const groups = allImageGroups();
  const result = await Promise.all(groups.map(async (group) => [group, (await listImages(group)).images]));
  state.images = Object.fromEntries(result);
}

function field(label, path, value, options = {}) {
  const { type = 'text', hint = '', readonly = false, min, max, step } = options;
  const input = type === 'textarea'
    ? `<textarea data-path="${esc(path)}" ${options.paragraphs ? 'data-paragraphs="true"' : ''}>${esc(Array.isArray(value) ? value.join('\n\n') : value)}</textarea>`
    : `<input data-path="${esc(path)}" type="${type}" value="${esc(value)}" ${readonly ? 'readonly' : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${step !== undefined ? `step="${step}"` : ''} />`;
  return `<label class="field"><span>${label}</span>${input}${hint ? `<small class="form-section-note">${hint}</small>` : ''}</label>`;
}

function renderNavigation() {
  const nav = $('#main-navigation');
  const sections = ['site', 'about', 'contact', 'categories'];
  nav.innerHTML = sections.map((sectionName) => `<button class="admin-nav-button ${state.section === sectionName ? 'is-active' : ''}" type="button" data-section="${sectionName}">${sectionLabels[sectionName]}</button>`).join('');
  const workNav = $('#work-navigation');
  workNav.hidden = false;
  const category = activeCategory();
  const works = category?.works || [];
  workNav.className = 'work-nav';
  workNav.innerHTML = `<div class="work-nav-header"><div class="work-nav-title"><span class="admin-label">作品列表</span><span class="work-nav-count">${works.length}</span></div><button class="mini-button work-nav-add" type="button" data-action="create-work" aria-label="新增作品" title="新增作品"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><label class="work-nav-category-field"><select class="work-nav-category" data-select-category aria-label="当前分类">${state.drafts.categories.map((item) => `<option value="${esc(item.slug)}" ${item.slug === state.categorySlug ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><div class="work-nav-list">${works.length ? works.map((work, index) => `<div class="work-nav-row" data-sort-item data-sort-path="works" data-sort-index="${index}" data-category-slug="${esc(category.slug)}" draggable="true"><button class="work-nav-button ${state.section === 'work' && work.slug === state.workSlug ? 'is-active' : ''}" type="button" data-action="select-work" data-slug="${esc(work.slug)}"><span>${esc(work.title)}</span></button><span class="work-nav-drag-handle" aria-hidden="true" title="拖动排序"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></span></div>`).join('') : '<p class="work-nav-empty">这个分类还没有作品</p>'}</div>`;
}

function renderEditor() {
  recordHistory();
  if (history) recomputeDirty();
  renderNavigation();
  const tools = $('#admin-tools');
  biographyStyleRoot?.unmount();
  biographyStyleRoot = null;
  tools.querySelector('.admin-section-tools')?.remove();
  if (state.section === 'site') {
    const site = state.drafts.site;
    tools.insertAdjacentHTML('beforeend', `<section class="admin-section-tools canvas-site-settings">
      <h2>网站设置</h2>
      ${field('网站标题', 'siteTitle', site.siteTitle)}
      ${field('网站简介', 'description', site.description, { type: 'textarea' })}
      <h3>首页背景轮播</h3>
      ${field('轮播间隔（秒）', 'rotationSeconds', site.rotationSeconds, { type: 'number', min: 0.1, max: 60, step: 0.1 })}
      <label class="canvas-random-toggle"><input type="checkbox" data-path="randomHomeCover" ${site.randomHomeCover ? 'checked' : ''} /><span>随机首张</span></label>
      <label class="canvas-random-toggle" title="深色模式自动反转标签页图标的颜色"><input type="checkbox" data-path="adaptiveFavicon" ${site.adaptiveFavicon === false ? '' : 'checked'} /><span>自动反色</span></label>
      <figure class="canvas-image canvas-favicon${site.favicon ? '' : ' is-empty'}">
        <div class="cover-image-viewport">${site.favicon ? `<img src="/${esc(site.favicon)}" alt="标签页图标预览" />` : '<span class="cover-image-empty">尚未添加图标</span>'}</div>
        <div class="cover-image-actions">
          <button class="puck-image-action" type="button" data-action="crop-favicon" aria-label="裁切标签页图标" title="裁切标签页图标" ${site.favicon ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" /></svg></button>
          <label class="puck-image-action cover-image-upload" title="更换标签页图标"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg><input type="file" accept="image/jpeg,image/png,image/webp" data-upload-path="favicon" data-upload-group="home" aria-label="上传或更换标签页图标" /></label>
          <button class="puck-image-action" type="button" data-remove-image-path="favicon" aria-label="移除标签页图标" title="移除标签页图标" ${site.favicon ? '' : 'disabled'}>${adminActionIcon('delete')}</button>
        </div>
      </figure>
    </section>`);
  }
  if (state.section === 'about') {
    const profile = state.drafts.about;
    tools.insertAdjacentHTML('beforeend', `<section class="admin-section-tools about-tools"><h2>个人介绍</h2><button class="canvas-add" type="button" data-action="add-fact">＋ 添加经历</button><h2>正文样式</h2>
      <label class="canvas-field"><span>预览语言</span><select id="about-preview-language"><option value="Ja" ${state.bioLanguage === 'Ja' ? 'selected' : ''}>日文</option><option value="Zh" ${state.bioLanguage === 'Zh' ? 'selected' : ''}>中文</option></select></label>
      <div id="biography-style-fields"></div>
    </section>`);
    const language = state.bioLanguage;
    const fontKey = `biographyFont${language}`;
    const styleKey = `biographyStyle${language}`;
    biographyStyleRoot = createRoot($('#biography-style-fields'));
    biographyStyleRoot.render(React.createElement(PuckTextStylePanel, {
      inline: true,
      type: 'paragraph',
      style: {
        ...profile[styleKey],
        fontFamily: profile[fontKey] || (language === 'Ja' ? 'Noto Sans JP' : 'Noto Sans SC'),
      },
      onStyleChange: (key, value) => {
        if (key === 'fontFamily') profile[fontKey] = value;
        else profile[styleKey] = { ...profile[styleKey], [key]: value };
        const biography = $('[data-bio-copy]');
        for (const [property, styleValue] of Object.entries(biographyTextStyle(profile, language))) {
          if (styleValue !== undefined) biography.style.setProperty(property, styleValue);
        }
        setDirty();
      },
    }));
  }
  if (state.section === 'categories') {
    const categories = state.drafts.categories;
    tools.insertAdjacentHTML('beforeend', `<section class="admin-section-tools category-tools">
      <h2>作品分类与管理</h2>
      <button class="canvas-add" type="button" data-action="create-category">＋ 新增分类</button>
      <h3>分类排序</h3>
      <ol>${categories.map((category, index) => `<li>
        <span>${esc(category.title)}</span>
        <button class="icon-button" type="button" data-action="move" data-path="" data-index="${index}" data-delta="-1" aria-label="${esc(category.title)} 上移" title="上移" ${index === 0 ? 'disabled' : ''}>${adminActionIcon('up')}</button>
        <button class="icon-button" type="button" data-action="move" data-path="" data-index="${index}" data-delta="1" aria-label="${esc(category.title)} 下移" title="下移" ${index === categories.length - 1 ? 'disabled' : ''}>${adminActionIcon('down')}</button>
      </li>`).join('')}</ol>
      <div class="category-trash-entry"><button class="button" type="button" data-action="open-work-trash">${adminActionIcon('delete')} 回收站</button></div>
    </section>`);
  }
  $('#canvas-toolbar').querySelector('.page-canvas-toolbar')?.remove();
  const canvas = $('#editor-canvas');
  const work = state.section === 'work' ? activeWork() : null;
  const usePuck = Boolean(work);
  canvas.parentElement.classList.toggle('puck-active', usePuck);
  canvas.classList.toggle('is-puck', usePuck);
  if (usePuck) {
    if (!puckRoot) puckRoot = createRoot(canvas);
    const key = workKey();
    puckRoot.render(React.createElement(PuckWorkEditor, {
      key: ensureWorkId(key),
      historyDocument: state.puckDocuments.get(ensureWorkId(key)),
      historyRevision: state.workEditorRevision,
      category: activeCategory(),
      categories: state.drafts.categories,
      work,
      images: state.images[`works/${state.categorySlug}`] || [],
      carouselSeconds: state.drafts.site.imageCarouselSeconds ?? 3,
      urlSlug: state.workRenames.get(key) ?? work.slug,
      siteTypography: state.drafts.site.typography || {},
      onChange: (document) => {
        const current = state.drafts.works[key];
        if (!current) return;
        const nextWork = puckDocumentToWork(document, current);
        const currentDocument = workToPuckDocument(current);
        const nextDocument = workToPuckDocument(nextWork);
        if (same(nextDocument, currentDocument) && same(state.puckDocuments.get(ensureWorkId(key)), document)) return;
        const id = ensureWorkId(key);
        state.puckDocuments.set(id, clone(document));
        state.drafts.works[key] = nextWork;
        const category = state.drafts.categories.find((item) => item.slug === nextWork.category);
        const index = category?.works.findIndex((item) => item.slug === nextWork.slug);
        if (index >= 0) category.works[index] = nextWork;
        setDirty();
      },
      onSaveTypography: async (type, style) => {
        state.drafts.site.typography = { ...(state.drafts.site.typography || {}), [type]: style };
        setDirty();
        renderEditor();
        return true;
      },
      onSaveCarouselSeconds: async (seconds) => {
        state.drafts.site.imageCarouselSeconds = Number(seconds);
        setDirty();
        renderEditor();
        return true;
      },
      onThumbnailUpload: async (file) => {
        try {
          showEditorFeedback('正在上传封面…');
          const result = await uploadImage(file, `works/${state.categorySlug}`);
          await refreshImages();
          const current = state.drafts.works[key];
          if (current) current.image = result.path;
          setDirty();
          showEditorFeedback('素材已载入');
          return result.path;
        } catch (error) { setError(error.message || '封面上传失败'); }
      },
      onGalleryUpload: async (file) => {
        try {
          showEditorFeedback('正在上传详情图片…');
          const result = await uploadImage(file, `works/${state.categorySlug}`);
          await refreshImages();
          setDirty();
          showEditorFeedback('素材已载入');
          return result.path;
        } catch (error) { setError(error.message || '详情图片上传失败'); }
      },
      onVideoUpload: async (file) => {
        try {
          showEditorFeedback('正在上传视频…');
          const result = await uploadVideo(file, state.categorySlug);
          setDirty();
          showEditorFeedback('素材已载入');
          return result.path;
        } catch (error) { setError(error.message || '视频上传失败'); }
      },
    }));
    clearStatus();
    return;
  }
  if (puckRoot) {
    puckRoot.unmount();
    puckRoot = null;
  }
  canvas.classList.remove('is-puck');
  canvas.onwheel = null;
  renderCanvas(canvas, state.section, activeDraft(), activeCategory(), { ...state.images, categories: state.drafts.categories, previewHomeCoverIndex: state.previewHomeCoverIndex, homePreviewMode: state.homePreviewMode, bioLanguage: state.bioLanguage });
  if (['site', 'about', 'contact'].includes(state.section)) bindPageCanvas(canvas);
  clearStatus();
}

function bindPageCanvas(canvas) {
  const viewport = canvas.parentElement;
  const sheet = canvas.firstElementChild;
  const width = 1224;
  sheet.classList.add('page-canvas-sheet');
  const host = $('#canvas-toolbar');
  host.insertAdjacentHTML('beforeend', `<div class="puck-canvas-toolbar page-canvas-toolbar" role="group" aria-label="画布缩放">
    <output class="canvas-zoom-value" aria-label="画布缩放比例"></output>
    <button type="button" data-zoom="fit" class="admin-icon-button" aria-label="适应宽度" title="适应宽度"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v-3"/><path d="M14 15v-3"/><path d="M18 15v-3"/><path d="M2 8V4"/><path d="M22 6H2"/><path d="M22 8V4"/><path d="M6 15v-3"/><rect x="2" y="12" width="20" height="8" rx="2"/></svg></button>
  </div>`);
  const toolbar = host.lastElementChild;
  let zoom = Number(viewport.dataset.pageZoom) || 0;
  const fit = () => (canvas.clientWidth - 2 * parseFloat(getComputedStyle(canvas).paddingLeft)) / width * 100;
  function apply(value, remember = true) {
    zoom = Math.max(10, Math.min(200, value));
    if (remember) viewport.dataset.pageZoom = String(zoom);
    sheet.style.zoom = zoom / 100;
    toolbar.querySelector('output').textContent = `${Math.round(zoom)}%`;
  }
  apply(zoom || fit(), false);
  toolbar.addEventListener('click', (event) => {
    if (event.target.closest('[data-zoom="fit"]')) apply(fit());
  });
  canvas.onwheel = (event) => {
    if (!event.ctrlKey || !sheet.isConnected) return;
    event.preventDefault();
    apply(zoom * Math.exp(-event.deltaY * .01));
  };
  sheet.querySelectorAll('[data-edit-path]').forEach((field) => {
    field.removeAttribute('contenteditable');
    field.tabIndex = 0;
    field.classList.add('js-edit-on-double-click');
  });
}

function markInput(input) {
  if (input.type === 'number' && (!input.value || !input.validity.valid)) return;
  const isEditable = input.hasAttribute('data-edit-path');
  let path = isEditable ? input.dataset.editPath : input.dataset.path;
  const raw = isEditable ? input.innerText.replace(/\r/g, '').trim() : input.value;
  const value = input.type === 'checkbox' ? input.checked : !isEditable && (input.dataset.number === 'true' || input.type === 'number') ? Number(raw) : raw;
  const listWorkEdit = typeof path === 'string' && path.match(/^work:([^:]+):([^:]+):(title|type)$/);
  if (listWorkEdit) {
    const [, categorySlug, workSlug, field] = listWorkEdit;
    const work = state.drafts.works[workKey(categorySlug, workSlug)];
    if (work) {
      work[field] = value;
      state.dirty.add(workKey(categorySlug, workSlug));
    }
  } else if (state.section === 'work' && path === 'categoryTitle') {
    const category = activeCategory();
    if (category) category.title = value;
    state.dirty.add('categories');
  } else {
    setPath(activeDraft(), path, value);
  }
  if (input.type === 'range') {
    const coverIndex = path.match(/^homeCovers\.(\d+)/)?.[1];
    const row = document.querySelector(`.canvas-cover-row[data-cover-index="${coverIndex}"]`);
    const image = row?.querySelector('.canvas-cover-image img');
    if (image && path.endsWith('.scale')) image.style.transform = `scale(${value})`;
    if (coverIndex === '0' && path.endsWith('.scale')) $('.canvas-home-image')?.style.setProperty('--cover-scale', String(value));
    const output = input.parentElement.querySelector('output');
    if (output) output.textContent = `${value.toFixed(2)}×`;
  }
  if (input.dataset.path && input.matches('select[data-path]')) {
    document.querySelectorAll('[data-bound-image-path]').forEach((image) => {
      if (image.dataset.boundImagePath === path) image.src = value ? `/${value.replace(/^\//, '')}` : '';
    });
    const coverIndex = path.match(/^homeCovers\.(\d+)\.src$/)?.[1];
    if (coverIndex !== undefined) {
      const hero = document.querySelector(`.canvas-home-image[data-cover-index="${coverIndex}"]`);
      if (hero) hero.src = value ? `/${value.replace(/^\//, '')}` : '';
    }
  }
  if (input.type === 'text' && path.startsWith('homeCovers.') && path.endsWith('.position')) {
    const index = path.split('.')[1];
    const rowImage = document.querySelector(`.canvas-cover-row[data-cover-index="${index}"] .canvas-cover-image img`);
    if (rowImage) rowImage.style.objectPosition = value || 'center';
    document.querySelector(`.canvas-home-image[data-cover-index="${index}"]`)?.style.setProperty('--cover-position', value || 'center');
  }
  if (path === 'rotationSeconds') {
    const hero = document.querySelector('.canvas-home-hero');
    if (hero) hero.dataset.rotationSeconds = String(value);
  }
  setDirty();
}

function moveArray(path, index, delta) {
  const target = activeDraft();
  const values = path ? getPath(target, path) : target;
  const next = index + delta;
  if (!Array.isArray(values) || next < 0 || next >= values.length) return;
  [values[index], values[next]] = [values[next], values[index]];
  if (path === 'homeCovers' || path === 'gallery' || path === 'sections' || path === 'facts') {
    // array order is stored directly in the array
  } else if (state.section === 'categories') {
    values.forEach((item, order) => { item.order = order; });
  }
  setDirty();
  renderEditor();
  showEditorFeedback('顺序已调整');
}

function stageWorkMove(destinationSlug) {
  const work = activeWork();
  const source = activeCategory();
  const destination = state.drafts.categories.find((item) => item.slug === destinationSlug);
  if (!work || !source || !destination || source.slug === destination.slug) return;

  if (destination.works.some((item) => item.slug === work.slug)) {
    return setError('目标分类已存在相同网址标识。');
  }

  source.works = source.works.filter((item) => item.slug !== work.slug);
  destination.works.push(work);
  work.category = destination.slug;
  const previousKey = workKey(source.slug, work.slug);
  const nextKey = workKey(destination.slug, work.slug);
  if (state.workRenames.has(previousKey)) {
    state.workRenames.set(nextKey, state.workRenames.get(previousKey));
    state.workRenames.delete(previousKey);
  }
  state.workIds.set(nextKey, ensureWorkId(previousKey));
  state.workIds.delete(previousKey);
  delete state.drafts.works[previousKey];
  state.drafts.works[nextKey] = work;
  source.works.forEach((item, order) => {
    item.order = order;
    state.drafts.works[workKey(source.slug, item.slug)] = item;
  });
  destination.works.forEach((item, order) => {
    item.order = order;
    state.drafts.works[workKey(destination.slug, item.slug)] = item;
  });
  state.categorySlug = destination.slug;
  state.workSlug = work.slug;
  state.section = 'work';
  setDirty();
  renderEditor();
  showEditorFeedback('作品分类已调整');
}

function moveArrayTo(path, from, to, categorySlug) {
  let values;
  if (path === 'works') values = state.drafts.categories.find((item) => item.slug === categorySlug)?.works;
  else values = path ? getPath(activeDraft(), path) : activeDraft();
  if (!Array.isArray(values) || from < 0 || to < 0 || from >= values.length || to >= values.length || from === to) return;
  const [item] = values.splice(from, 1);
  values.splice(to, 0, item);
  if (path === 'works') {
    values.forEach((work, order) => {
      work.order = order;
      state.drafts.works[workKey(categorySlug, work.slug)] = work;
      state.dirty.add(workKey(categorySlug, work.slug));
    });
  } else if (!path && state.section === 'categories') {
    values.forEach((category, order) => { category.order = order; });
  }
  setDirty();
  renderEditor();
  showEditorFeedback('顺序已调整');
}

function openCreate(kind) {
  state.createKind = kind;
  const dialog = $('#create-dialog');
  const work = kind === 'work';
  $('#dialog-eyebrow').textContent = work ? '新增作品' : '新增分类';
  $('#create-title-label').textContent = work ? '作品名称' : '分类名称';
  $('#create-category-row').hidden = !work;
  $('#create-category').innerHTML = state.drafts.categories.map((category) => `<option value="${esc(category.slug)}">${esc(category.title)}</option>`).join('');
  $('#create-category').value = state.categorySlug;
  $('#create-title').value = '';
  $('#create-slug').value = '';
  $('#create-slug-error').textContent = '';
  dialog.showModal();
  $('#create-title').focus();
}

function reportDuplicateSlug(message) {
  $('#create-slug-error').textContent = message;
  showEditorFeedback('无法创建', { kind: 'error', detail: message });
  $('#create-slug').focus();
}

function createItem(event) {
  event.preventDefault();
  const title = $('#create-title').value.trim();
  const slug = $('#create-slug').value.trim();
  const kind = state.createKind;
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { showEditorFeedback('无法创建', { kind: 'error', detail: '请填写名称和有效的网址标识。' }); return; }
  if (kind === 'category') {
    if (state.drafts.categories.some((category) => category.slug === slug)) return reportDuplicateSlug('分类网址标识已存在');
    state.drafts.categories.push({ slug, title, kind: 'grid', order: state.drafts.categories.length, works: [] });
    state.section = 'categories';
    state.dirty.add('categories');
  } else {
    const category = state.drafts.categories.find((item) => item.slug === $('#create-category').value);
    if (!category) return;
    if (category.works.some((work) => work.slug === slug)) return reportDuplicateSlug('此分类下已存在相同网址标识');
    const template = category.slug === 'research' ? undefined : category.slug === 'photography' ? 'photographyGallery' : ['product', 'installation', 'visual'].includes(category.slug) ? 'splitDetail' : 'articleReading';
    const work = { slug, category: category.slug, title, type: '', order: category.works.length, ...(template ? { template } : {}), sections: [] };
    state.workIds.set(workKey(category.slug, slug), crypto.randomUUID());
    category.works.push(work);
    state.drafts.works[workKey(category.slug, slug)] = work;
    state.categorySlug = category.slug;
    state.workSlug = slug;
    state.section = 'work';
    state.dirty.add(workKey(category.slug, slug));
  }
  $('#create-dialog').close();
  renderEditor();
  clearStatus();
  showEditorFeedback(kind === 'work' ? '已创建作品草稿' : '已创建分类草稿');
}

function rewriteClientWorkLinks(fromCategory, fromSlug, toCategory, toSlug) {
  for (const draft of Object.values(state.drafts.works)) rewriteWorkLinks(draft, fromCategory, fromSlug, toSlug, toCategory);
  for (const baseline of savedWorks.values()) if (baseline.work) rewriteWorkLinks(baseline.work, fromCategory, fromSlug, toSlug, toCategory);
  for (const document of state.puckDocuments.values()) rewriteWorkLinks(document, fromCategory, fromSlug, toSlug, toCategory);
  history.rebase((snapshot) => {
    for (const [key, record] of Object.entries(snapshot)) if (key.startsWith('work:')) {
      rewriteWorkLinks(record.work, fromCategory, fromSlug, toSlug, toCategory);
      rewriteWorkLinks(record.document, fromCategory, fromSlug, toSlug, toCategory);
    }
    return snapshot;
  });
}
function replaceMediaPaths(value, replacements) {
  if (typeof value === 'string') return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceMediaPaths(item, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceMediaPaths(item, replacements)]));
  return value;
}
function mediaReplacements(before, after, result = new Map()) {
  if (typeof before === 'string' && /^(images|videos)\//.test(before) && typeof after === 'string' && before !== after) result.set(before, after);
  else if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of Object.keys(before)) mediaReplacements(before[key], after[key], result);
  }
  return result;
}
function lockEditing(locked) {
  for (const selector of ['.admin-editor', '#admin-tools', '.admin-navigation-rail']) {
    const element = $(selector);
    if (element) element.inert = locked;
  }
}
async function protectHistoryMedia() {
  if (history) await retainHistoryMedia(history.mediaPaths());
}
function saveBatchRecords() {
  const records = [];
  const removed = [];
  if (!same(categoryMetadata(), savedSections.categories)) records.push({ section: 'categories', segments: [], value: categoryMetadata() });
  for (const section of ['site', 'about', 'contact']) {
    if (!same(state.drafts[section], savedSections[section])) records.push({ section, segments: [], value: clone(state.drafts[section]) });
  }
  const present = new Set(Object.keys(state.drafts.works).map(ensureWorkId));
  for (const [key, work] of Object.entries(state.drafts.works)) {
    const id = ensureWorkId(key);
    const saved = savedWorks.get(id);
    const slug = state.workRenames.get(key) ?? work.slug;
    if (!saved?.work || !same(work, saved.work) || slug !== saved.slug) {
      records.push({ section: 'work', segments: [work.category, slug], value: { ...clone(work), slug } });
    }
  }
  for (const [id, saved] of savedWorks) if (saved.work && !present.has(id)) removed.push(`work/${saved.category}/${saved.slug}`);
  return { records, removed };
}
async function saveAllDirty() {
  if (state.busy || composing) return;
  history?.end();
  recordHistory();
  recomputeDirty();
  if (!state.dirty.size) return;
  state.busy = true;
  lockEditing(true);
  clearStatus();
  showEditorFeedback('正在保存…');
  $('#save-button').setAttribute('aria-busy', 'true');
  let identitiesChanged = false;
  let saveError = null;
  let batchId = '';
  try {
    // Validate requested names before sending any work mutations.
    const destinations = new Set();
    for (const [key, work] of Object.entries(state.drafts.works)) {
      const slug = state.workRenames.get(key) ?? work.slug;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('网址标识须使用小写英文、数字和连字符。');
      const destination = workKey(work.category, slug);
      if (destinations.has(destination)) throw new Error('此分类下已存在相同网址标识。');
      destinations.add(destination);
    }
    const batch = saveBatchRecords();
    await validateBatch(batch.records, batch.removed);
    const startedBatch = await beginBatch();
    batchId = startedBatch.id;
    await protectHistoryMedia();
    const categories = categoryMetadata();
    // Keep source categories available until all moves / trash restores finish.
    const temporaryCategories = [...categories, ...(savedSections.categories || []).filter((old) => !categories.some((item) => item.slug === old.slug))];
    if (!same(temporaryCategories, savedSections.categories)) {
      await saveRecord('categories', temporaryCategories);
      savedSections.categories = clone(temporaryCategories);
    }
    const present = new Set(Object.keys(state.drafts.works).map(ensureWorkId));
    const pendingTrash = [];
    for (const [id, saved] of savedWorks) {
      if (!saved.work || present.has(id)) continue;
      pendingTrash.push([id, saved]);
    }
    for (const [originalKey, originalWork] of Object.entries(state.drafts.works)) {
      const id = ensureWorkId(originalKey);
      let work = originalWork;
      let saved = savedWorks.get(id);
      const desiredSlug = state.workRenames.get(originalKey) ?? work.slug;
      if (saved?.trashId && !saved.work) {
        const result = await restoreWork(saved.trashId);
        saved.work = clone(result.work);
        saved.trashId = null;
      }
      if (saved?.work && saved.category !== work.category) {
        const previousCategory = saved.category;
        const previousSlug = saved.slug;
        const movingDraft = { ...work, slug: saved.slug };
        const result = await transferWork(saved.category, work.category, saved.slug, movingDraft);
        const replacements = mediaReplacements(movingDraft, result.work);
        saved.category = work.category;
        saved.work = clone(result.work);
        work = { ...result.work, slug: work.slug };
        state.drafts.works[originalKey] = work;
        if (state.puckDocuments.has(id)) state.puckDocuments.set(id, replaceMediaPaths(state.puckDocuments.get(id), replacements));
        history.rebase((snapshot) => {
          const record = snapshot[`work:${id}`];
          if (record?.work.category === work.category) snapshot[`work:${id}`] = replaceMediaPaths(record, replacements);
          return snapshot;
        });
        rewriteClientWorkLinks(previousCategory, previousSlug, work.category, work.slug);
        identitiesChanged = true;
      }
      if (saved?.work && saved.slug !== desiredSlug) {
        const previousSlug = saved.slug;
        await renameWork(work.category, previousSlug, desiredSlug);
        saved.slug = desiredSlug;
        saved.work.slug = desiredSlug;
        rewriteClientWorkLinks(work.category, previousSlug, work.category, desiredSlug);
        identitiesChanged = true;
      }
      work.slug = desiredSlug;
      const key = workKey(work.category, desiredSlug);
      if (key !== originalKey) {
        delete state.drafts.works[originalKey];
        state.workIds.delete(originalKey);
        state.drafts.works[key] = work;
        state.workIds.set(key, id);
        state.workRenames.delete(originalKey);
        if (workKey() === originalKey) state.workSlug = desiredSlug;
        identitiesChanged = true;
      }
      const category = state.drafts.categories.find((item) => item.slug === work.category);
      const index = category.works.findIndex((item) => item === originalWork || item.slug === originalWork.slug);
      if (index >= 0) category.works[index] = work;
      if (!saved?.work || !same(work, saved.work)) {
        await saveRecord('work', clone(work), [work.category, work.slug]);
        saved = { category: work.category, slug: work.slug, work: clone(work) };
        savedWorks.set(id, saved);
      }
    }
    state.workRenames.clear();
    for (const section of ['site', 'about', 'contact']) {
      if (same(state.drafts[section], savedSections[section])) continue;
      const record = clone(state.drafts[section]);
      await saveRecord(section, record);
      savedSections[section] = record;
      state.content[section] = clone(record);
    }
    if (!same(categories, savedSections.categories)) {
      await saveRecord('categories', categories);
      savedSections.categories = clone(categories);
    }
    for (const [, saved] of pendingTrash) {
      const { entry } = await removeWork(saved.category, saved.slug);
      saved.trashId = entry.id;
      saved.work = null;
    }
    await protectHistoryMedia();
    await pruneOrphanImages();
    const committed = await commitBatch();
    batchId = '';
    if (committed.cleanupWarning) saveError = `内容已保存，但${committed.cleanupWarning}`;
    await refreshImages();
  } catch (error) {
    saveError = error.message || '保存失败';
    if (batchId) {
      try { await rollbackBatch(); }
      catch (rollbackError) { saveError = `${saveError}；自动恢复失败，请核对本次涉及的文件：${rollbackError.message || '恢复失败'}`; }
      batchId = '';
    }
  } finally {
    state.busy = false;
    $('#save-button').removeAttribute('aria-busy');
    lockEditing(false);
    recomputeDirty();
    $('#save-button').disabled = !state.dirty.size;
    updateHistoryButtons();
    if (identitiesChanged) {
      state.workEditorRevision += 1;
      restoringHistory = true;
      renderEditor();
      restoringHistory = false;
    }
  }
  if (saveError) setError(saveError);
  else { clearStatus(); showEditorFeedback('已保存到本机', { detail: '本机内容已更新。' }); }
}

let pendingDeletion = null;

function confirmWorkDeletion(categorySlug, slug) {
  const key = workKey(categorySlug, slug);
  const work = state.drafts.works[key];
  if (!work || state.busy) return;
  pendingDeletion = { categorySlug, slug, key };
  $('#work-delete-message').textContent = `将「${work.title}」移到回收站？之后可以恢复到原分类。`;
  const unsaved = state.dirty.has(key);
  $('#work-delete-error').textContent = unsaved ? '这项内容有未保存的修改，请先保存。' : '';
  $('#work-delete-confirm').disabled = unsaved;
  $('#work-delete-dialog').showModal();
}

async function moveWorkToTrash() {
  if (!pendingDeletion || state.busy) return;
  const { categorySlug, slug, key } = pendingDeletion;
  if (state.dirty.has(key)) return;
  state.busy = true;
  const confirm = $('#work-delete-confirm');
  const cancel = $('#work-delete-cancel');
  confirm.disabled = cancel.disabled = true;
  clearStatus();
  try {
    await protectHistoryMedia();
    const { entry } = await removeWork(categorySlug, slug);
    const id = ensureWorkId(key);
    const saved = savedWorks.get(id);
    if (saved) { saved.trashId = entry.id; saved.work = null; }
    for (const categories of [state.content.categories, state.drafts.categories]) {
      const category = categories.find((item) => item.slug === categorySlug);
      if (category) category.works = category.works.filter((work) => work.slug !== slug);
    }
    delete state.drafts.works[key];
    if (state.categorySlug === categorySlug && state.workSlug === slug) {
      state.workSlug = activeCategory()?.works[0]?.slug || '';
    }
    state.section = 'categories';
    $('#work-delete-dialog').close();
    state.busy = false;
    renderEditor();
    showEditorFeedback('已移到回收站', { detail: '可在回收站恢复。' });
  } catch (error) {
    $('#work-delete-error').textContent = error.message || '无法移到回收站。';
  } finally {
    state.busy = false;
    confirm.disabled = cancel.disabled = false;
    clearStatus();
  }
}

async function renderWorkTrash() {
  const list = $('#work-trash-list');
  const errorMessage = $('#work-trash-error');
  errorMessage.textContent = '';
  list.textContent = '正在读取…';
  try {
    const { entries } = await loadTrash();
    const rows = entries.map(({ id, work }) => {
      const category = state.drafts.categories.find((item) => item.slug === work.category);
      return `<li><div><strong>${esc(work.title)}</strong><small>${esc(category?.title || work.category)}</small></div>
        <button class="button" data-action="restore-work" data-id="${esc(id)}" data-category="${esc(work.category)}"
          data-slug="${esc(work.slug)}" type="button" aria-label="恢复：${esc(work.title)}">恢复</button></li>`;
    });
    list.innerHTML = rows.length ? `<ul class="work-trash-items">${rows.join('')}</ul>` : '<p>回收站为空。</p>';
  } catch (error) {
    list.textContent = '';
    errorMessage.textContent = error.message || '无法读取回收站。';
  }
}

async function restoreTrashedWork(button) {
  if (state.busy) return;
  const { id, category: categorySlug, slug } = button.dataset;
  const category = state.drafts.categories.find((item) => item.slug === categorySlug);
  const key = workKey(categorySlug, slug);
  const errorMessage = $('#work-trash-error');
  if (!category || state.drafts.works[key]) {
    errorMessage.textContent = category ? '原分类中已有相同网址标识的作品。' : '原分类已删除。请先重新创建该分类。';
    return;
  }
  state.busy = true;
  button.disabled = true;
  clearStatus();
  try {
    const { work } = await restoreWork(id);
    category.works.push(work);
    category.works.sort((a, b) => a.order - b.order);
    state.drafts.works[key] = work;
    const previous = [...savedWorks].find(([, saved]) => saved.trashId === id);
    const workId = previous?.[0] ?? ensureWorkId(key);
    state.workIds.set(key, workId);
    savedWorks.set(workId, { category: work.category, slug: work.slug, work: clone(work) });
    const savedCategory = state.content.categories.find((item) => item.slug === categorySlug);
    savedCategory?.works.push(clone(work));
    state.busy = false;
    renderEditor();
    await renderWorkTrash();
    showEditorFeedback('作品已恢复', { detail: '本机内容已恢复。' });
  } catch (error) {
    errorMessage.textContent = error.message || '恢复失败。';
  } finally {
    state.busy = false;
    button.disabled = false;
    clearStatus();
  }
}

function doAction(button) {
  const action = button.dataset.action;
  if (action === 'crop-favicon' || action === 'crop-portrait') {
    const portrait = action === 'crop-portrait';
    const key = portrait ? 'about' : 'site';
    const draft = state.drafts[key];
    const field = portrait ? 'portrait' : 'favicon';
    const source = draft[field];
    if (!source) return;
    openImageCropEditor({
      src: source,
      aspect: portrait ? 2 / 3 : 1,
      onConfirm: async ({ exportCrop }) => {
        const result = await uploadImage(await exportCrop(), portrait ? 'about' : 'home');
        if (draft[field] !== source) return;
        draft[field] = result.path;
        state.dirty.add(key);
        renderEditor();
      },
    });
    return;
  }
  if (action === 'move') return moveArray(button.dataset.path, Number(button.dataset.index), Number(button.dataset.delta));
  if (action === 'create-work') return openCreate('work');
  if (action === 'create-category') return openCreate('category');
  if (action === 'add-cover') { state.drafts.site.homeCovers.push({ src: '', alt: '', scale: 1, position: 'center' }); state.section = 'site'; state.dirty.add('site'); return renderEditor(); }
  if (action === 'toggle-home-preview-mode') {
    state.homePreviewMode = state.homePreviewMode === 'mobile' ? 'desktop' : 'mobile';
    return renderEditor();
  }
  if (action === 'preview-home-cover') {
    const covers = state.drafts.site.homeCovers || [];
    if (!covers.length) return;
    state.previewHomeCoverIndex = (state.previewHomeCoverIndex + Number(button.dataset.delta) + covers.length) % covers.length;
    document.querySelectorAll('.canvas-home-image').forEach((image, index) => image.classList.toggle('is-visible', index === state.previewHomeCoverIndex));
    const counter = document.querySelector('.canvas-home-preview-controls span');
    if (counter) counter.textContent = `${String(state.previewHomeCoverIndex + 1).padStart(2, '0')} / ${String(covers.length).padStart(2, '0')}`;
    return;
  }
  if (action === 'add-fact') { state.drafts.about.facts.push({ period: '', text: '' }); state.section = 'about'; state.dirty.add('about'); return renderEditor(); }
  if (action === 'add-bio-paragraph') { state.drafts.about[button.dataset.lang].push(''); state.section = 'about'; state.dirty.add('about'); return renderEditor(); }
  if (action === 'remove') {
    const values = getPath(activeDraft(), button.dataset.path);
    values.splice(Number(button.dataset.index), 1);
    if (button.dataset.path === 'homeCovers') state.previewHomeCoverIndex = Math.min(state.previewHomeCoverIndex, values.length - 1);
    setDirty();
    return renderEditor();
  }
  if (action === 'add-gallery-image') { const work = activeWork(); if (!Array.isArray(work.gallery)) work.gallery = work.image ? [work.image] : []; work.gallery.push(''); setDirty(); return renderEditor(); }
  if (action === 'select-work') { if (button.dataset.category) state.categorySlug = button.dataset.category; state.workSlug = button.dataset.slug; state.section = 'work'; window.scrollTo(0, 0); return renderEditor(); }
  if (action === 'move-work') return stageWorkMove($('#admin-tools [data-move-category]')?.value);
  if (action === 'delete-work') return confirmWorkDeletion(button.dataset.category || state.categorySlug, button.dataset.slug || state.workSlug);
  if (action === 'open-work-trash') {
    $('#work-trash-dialog').showModal();
    return renderWorkTrash();
  }
  if (action === 'restore-work') return restoreTrashedWork(button);
  if (action === 'delete-category') {
    const category = state.drafts.categories.find((item) => item.slug === button.dataset.slug);
    if (category?.works?.length) return setError('请先移出或删除此分类中的作品');
    if (!window.confirm(`删除空分类「${category.title}」？`)) return;
    state.drafts.categories = state.drafts.categories.filter((item) => item.slug !== category.slug);
    state.drafts.categories.forEach((item, order) => { item.order = order; });
    state.dirty.add('categories');
    return renderEditor();
  }
}

async function handleUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const draft = activeDraft();
    const key = activeDirtyKey();
    showEditorFeedback('正在上传图片…');
    const result = await uploadImage(file, input.dataset.uploadGroup);
    await refreshImages();
    setPath(draft, input.dataset.uploadPath, result.path);
    state.dirty.add(key);
    renderEditor();
    showEditorFeedback('图片已载入');
  } catch (error) { setError(error.message || '上传失败'); }
}

async function handleNewCoverUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    showEditorFeedback('正在上传首页背景…');
    const result = await uploadImage(file, 'home');
    await refreshImages();
    state.drafts.site.homeCovers.push({ src: result.path, alt: '', scale: 1, position: 'center' });
    state.previewHomeCoverIndex = state.drafts.site.homeCovers.length - 1;
    state.dirty.add('site');
    renderEditor();
    showEditorFeedback('首页背景已载入');
  } catch (error) { setError(error.message || '首页背景上传失败'); }
  finally { input.value = ''; }
}

function handleRemoveImage(button) {
  const path = button.dataset.removeImagePath;
  if (!path) return;
  setPath(activeDraft(), path, '');
  setDirty();
  renderEditor();
}

async function boot() {
  try {
    state.content = await loadContent();
    state.drafts = {
      site: clone(state.content.site),
      about: clone(state.content.about),
      contact: clone(state.content.contact),
      categories: clone(state.content.categories),
      works: {},
    };
    for (const category of state.drafts.categories) for (const work of category.works) state.drafts.works[workKey(category.slug, work.slug)] = work;
    state.categorySlug = state.drafts.categories[0]?.slug || '';
    state.workSlug = activeCategory()?.works[0]?.slug || '';
    for (const [key, work] of Object.entries(state.drafts.works)) {
      savedWorks.set(ensureWorkId(key), { category: work.category, slug: work.slug, work: clone(work) });
    }
    savedSections = { site: clone(state.drafts.site), about: clone(state.drafts.about), contact: clone(state.drafts.contact), categories: clone(categoryMetadata()) };
    history = createEditorHistory(historySnapshot());
    await refreshImages();
    renderEditor();
  } catch (error) {
    $('#editor-canvas').innerHTML = `<p class="empty-state">无法读取本机内容：${esc(error.message)}<br />请返回作品集本地预览检查服务状态。</p>`;
    setError('读取失败');
  }
}

document.addEventListener('click', async (event) => {
  const cropButton = event.target.closest('[data-action="crop-home-cover"]');
  if (cropButton) {
    const index = Number(cropButton.dataset.index);
    const cover = state.drafts.site.homeCovers?.[index];
    if (!cover?.src) return;
    const viewportAspect = window.innerWidth / Math.max(1, window.innerHeight);
    const desktopAspect = viewportAspect >= 1.2 ? viewportAspect : 16 / 9;
    const mobileAspect = 9 / 16;
    openImageCropEditor({
      src: cover.src,
      variants: [
        { id: 'desktop', label: '横版（桌面）', aspect: desktopAspect, scale: cover.scale || 1, position: cover.position || 'center', fixedAspect: true },
        { id: 'mobile', label: '竖版（手机）', aspect: mobileAspect, scale: cover.mobileScale ?? cover.scale ?? 1, position: cover.mobilePosition || cover.position || 'center', fixedAspect: true },
      ],
      onConfirm: async ({ variants }) => {
        const desktop = variants?.desktop;
        const mobile = variants?.mobile;
        if (desktop) {
          cover.scale = desktop.scale;
          cover.position = desktop.position;
        }
        if (mobile) {
          cover.mobileScale = mobile.scale;
          cover.mobilePosition = mobile.position;
        }
        state.dirty.add('site');
        const rowImage = document.querySelector(`.canvas-cover-row[data-cover-index="${index}"] .cover-image-viewport img`);
        if (rowImage) { rowImage.style.transform = `scale(${cover.scale})`; rowImage.style.objectPosition = cover.position; }
        const hero = document.querySelector(`.canvas-home-image[data-cover-index="${index}"]`);
        if (hero) {
          hero.style.setProperty('--cover-scale', String(cover.scale));
          hero.style.setProperty('--cover-position', cover.position);
          hero.style.setProperty('--cover-mobile-scale', String(cover.mobileScale ?? cover.scale));
          hero.style.setProperty('--cover-mobile-position', cover.mobilePosition || cover.position);
        }
        setDirty();
      },
    });
    return;
  }
  const sectionButton = event.target.closest('[data-section]');
  if (sectionButton) { state.section = sectionButton.dataset.section; if (state.section === 'work' && !state.workSlug) state.workSlug = activeCategory()?.works[0]?.slug || ''; window.scrollTo(0, 0); return renderEditor(); }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) return doAction(actionButton);
  const removeImageButton = event.target.closest('[data-remove-image-path]');
  if (removeImageButton) return handleRemoveImage(removeImageButton);
  if (event.target.closest('#save-button')) return saveAllDirty();
});

function beginCanvasEdit(field) {
  if (!field || field.isContentEditable) return;
  field.contentEditable = field.dataset.bioCopy ? 'true' : 'plaintext-only';
  if (field.dataset.bioCopy) {
    writeEditorParagraphs(field, state.drafts.about[field.dataset.bioCopy]);
    field.addEventListener('paste', pasteEditorText);
    focusParagraphEditor(field);
  } else {
    field.focus();
  }
}
function isLocalHistoryField(target) {
  return Boolean(target.closest('dialog, form, .puck-text-style-panel, .puck-carousel-settings, .puck-placement-dialog, .image-crop-dialog'));
}
document.addEventListener('beforeinput', (event) => {
  if (state.busy) { event.preventDefault(); return; }
  if (isLocalHistoryField(event.target)) return;
  beforeInputFocus = captureFocus();
  if (['historyUndo', 'historyRedo'].includes(event.inputType) && !isLocalHistoryField(event.target)) {
    event.preventDefault();
    travelHistory(event.inputType === 'historyUndo' ? 'undo' : 'redo');
  }
}, true);
document.addEventListener('compositionstart', () => { composing = true; beforeInputFocus = captureFocus(); history?.begin(); }, true);
document.addEventListener('compositionend', () => {
  composing = false;
  queueMicrotask(() => { history?.end(); updateHistoryButtons(); });
}, true);
document.addEventListener('pointerdown', (event) => {
  if (event.target.matches('input[type="range"]')) history?.begin();
  if (event.target.closest('#undo-button, #redo-button')) event.preventDefault();
}, true);
for (const type of ['pointerup', 'pointercancel', 'change']) document.addEventListener(type, () => {
  if (!composing) queueMicrotask(() => { history?.end(); updateHistoryButtons(); });
}, true);
window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing || composing) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.shiftKey)) return;
  // Unapplied dialog fields retain native undo; confirmed changes join the shared history.
  if (isLocalHistoryField(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) travelHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
}, true);
$('#undo-button').addEventListener('click', () => travelHistory('undo'));
$('#redo-button').addEventListener('click', () => travelHistory('redo'));
document.addEventListener('dblclick', (event) => beginCanvasEdit(event.target.closest('.js-edit-on-double-click')));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('.js-edit-on-double-click') && !event.target.isContentEditable) {
    event.preventDefault();
    beginCanvasEdit(event.target);
  }
});
document.addEventListener('focusout', (event) => {
  const field = event.target;
  if (!field.matches('.js-edit-on-double-click') || !field.isContentEditable) return;
  field.removeAttribute('contenteditable');
  field.removeEventListener('paste', pasteEditorText);
});
document.addEventListener('input', (event) => {
  const field = event.target;
  if (field.matches('[data-work-url-slug]')) {
    const key = workKey();
    if (field.value === state.workSlug) state.workRenames.delete(key);
    else state.workRenames.set(key, field.value);
    setDirty();
  }
  if (field.dataset.bioCopy) {
    state.drafts.about[field.dataset.bioCopy] = readEditorParagraphs(field);
    setDirty();
  }
  if (field.matches('[data-path], [data-edit-path]')) markInput(field);

});
document.addEventListener('change', async (event) => {
  const input = event.target;
  if (input.id === 'about-preview-language') {
    state.bioLanguage = input.value;
    return renderEditor();
  }
  if (input.matches('[data-upload-new-cover]')) return handleNewCoverUpload(input);
  if (input.matches('[data-upload-path]')) return handleUpload(input);
  if (input.matches('[data-select-category]')) { state.categorySlug = input.value; state.workSlug = activeCategory()?.works[0]?.slug || ''; window.scrollTo(0, 0); return renderEditor(); }
  if (input.matches('[data-path], [data-edit-path]')) {
    markInput(input);
    const path = input.dataset.path || input.dataset.editPath || '';
    if (/\.(?:kind|layout)$/.test(path) || path === 'template' || path === 'favicon' || path.startsWith('biographyFont') || path.startsWith('biographyStyle')) renderEditor();
  }
});

let draggedItem = null;
document.addEventListener('dragstart', (event) => {
  const item = event.target.closest('[data-sort-item]');
  if (!item) return;
  draggedItem = item;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${item.dataset.sortPath || ''}:${item.dataset.sortIndex}`);
  item.classList.add('is-dragging');
});
document.addEventListener('dragend', () => {
  draggedItem?.classList.remove('is-dragging');
  document.querySelectorAll('.is-drop-target').forEach((item) => item.classList.remove('is-drop-target'));
  draggedItem = null;
});
document.addEventListener('dragover', (event) => {
  const target = event.target.closest('[data-sort-item]');
  if (draggedItem && target && target !== draggedItem && target.dataset.sortPath === draggedItem.dataset.sortPath && target.dataset.categorySlug === draggedItem.dataset.categorySlug) {
    event.preventDefault();
    target.classList.add('is-drop-target');
  }
});
document.addEventListener('dragleave', (event) => event.target.closest('[data-sort-item]')?.classList.remove('is-drop-target'));
document.addEventListener('drop', (event) => {
  const target = event.target.closest('[data-sort-item]');
  if (!draggedItem || !target || target === draggedItem) return;
  if (target.dataset.sortPath !== draggedItem.dataset.sortPath || target.dataset.categorySlug !== draggedItem.dataset.categorySlug) return;
  event.preventDefault();
  moveArrayTo(draggedItem.dataset.sortPath || '', Number(draggedItem.dataset.sortIndex), Number(target.dataset.sortIndex), draggedItem.dataset.categorySlug);
});
$('#create-form').addEventListener('submit', createItem);
$('#create-form').addEventListener('input', (event) => {
  if (event.target.matches('#create-slug, #create-category')) $('#create-slug-error').textContent = '';
});
$('#create-cancel').addEventListener('click', () => $('#create-dialog').close());
window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  const saveButton = $('#save-button');
  if (!event.repeat && !saveButton.disabled) saveButton.click();
});
window.addEventListener('beforeunload', (event) => { if (state.dirty.size) { event.preventDefault(); event.returnValue = ''; } });
boot();

$('#work-delete-confirm').addEventListener('click', moveWorkToTrash);
$('#work-delete-cancel').addEventListener('click', () => $('#work-delete-dialog').close());
$('#work-delete-dialog').addEventListener('cancel', (event) => { if (state.busy) event.preventDefault(); });
$('#work-delete-dialog').addEventListener('close', () => { pendingDeletion = null; });
$('#work-trash-close').addEventListener('click', () => $('#work-trash-dialog').close());
