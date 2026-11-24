import { workThumbnail, thumbnailStyle } from '../../src/lib/content/work-thumbnail.js';
import { observeWorkMasonry } from '../../src/lib/content/work-masonry.js';
let stopMasonry = () => {};
import { adminActionIcon } from '../../src/lib/admin/action-icons.js';
import { biographyTextStyle } from '../../src/lib/content/biography-style.js';
import { renderSiteNavigation } from '../../src/lib/site-navigation-markup.js';
import { CONTACT_ICONS } from '../../src/lib/content/contact-icons.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function imagePath(value) {
  return typeof value === 'string' && value ? `/${value.replace(/^\//, '')}` : '';
}

function editable(tag, className, value, path, options = {}) {
  const { multiline = false, label = '文本', paragraphs = false, lang = '' } = options;
  if (paragraphs) {
    const content = (Array.isArray(value) ? value : []).map((paragraph, index) => `<p class="editable-paragraph" data-sort-list="${esc(path)}" data-sort-path="${esc(path)}" data-sort-index="${index}" data-sort-item draggable="true"><button class="drag-handle" type="button" draggable="true" aria-label="拖动段落">⠿</button><span ${editableAttrs(`${path}.${index}`, label, false, lang)}>${esc(paragraph)}</span><button class="remove-inline" type="button" data-action="remove" data-path="${esc(path)}" data-index="${index}" aria-label="删除段落">${adminActionIcon('delete')}</button></p>`).join('');
    return `<${tag} class="${esc(className)}" data-sort-list="${esc(path)}">${content}</${tag}>`;
  }
  return `<${tag} class="${esc(className)}" ${editableAttrs(path, label, multiline, lang)}>${esc(Array.isArray(value) ? value.join('\n\n') : value)}</${tag}>`;
}

function editableAttrs(path, label, multiline, lang = '') {
  return `contenteditable="plaintext-only" role="textbox" aria-label="${esc(label)}" aria-multiline="${Boolean(multiline)}" data-edit-path="${esc(path)}" ${multiline ? 'data-edit-multiline="true"' : ''} ${lang ? `lang="${esc(lang)}"` : ''}`;
}

function renderHome(site, images) {
  const covers = site.homeCovers || [];
  const previewIndex = Math.min(Number(images.previewHomeCoverIndex) || 0, Math.max(covers.length - 1, 0));
  const isMobilePreview = images.homePreviewMode === 'mobile';
  const heroImages = covers.map((item, index) => `<img class="${index === previewIndex ? 'is-visible' : ''} canvas-home-image" data-cover-index="${index}" src="${imagePath(item.src)}" alt="${esc(item.alt)}" style="--cover-scale:${Number(item.scale || 1)};--cover-position:${esc(item.position || 'center')};--cover-mobile-scale:${Number(item.mobileScale ?? item.scale ?? 1)};--cover-mobile-position:${esc(item.mobilePosition || item.position || 'center')}" />`).join('');
  const navigation = renderSiteNavigation({ base: '/', routeBase: '/', active: 'home', sections: images.categories || [], expanded: false, showAdminEntry: false });
  const navControls = covers.length > 1 ? `<button type="button" data-action="preview-home-cover" data-delta="-1" aria-label="上一张背景">←</button><span>${String(previewIndex + 1).padStart(2, '0')} / ${String(covers.length).padStart(2, '0')}</span><button type="button" data-action="preview-home-cover" data-delta="1" aria-label="下一张背景">→</button>` : '';
  const modeToggle = `<button type="button" class="canvas-home-preview-mode" data-action="toggle-home-preview-mode" aria-pressed="${isMobilePreview}" title="切换横版/竖版预览">${isMobilePreview ? '竖版' : '横版'}</button>`;
  const previewControls = `<div class="canvas-home-preview-controls">${modeToggle}${navControls}</div>`;
  const hero = `<div class="home-hero canvas-home-hero${isMobilePreview ? ' is-mobile-preview' : ''}"><aside class="sidebar canvas-home-navigation">${navigation}</aside>${heroImages}${previewControls}</div>`;
  const coverCards = covers.map((item, index) => {
    const path = `homeCovers.${index}.src`;
    return `<article class="canvas-cover-row" data-cover-index="${index}" data-sort-list="homeCovers" data-sort-path="homeCovers" data-sort-index="${index}" data-sort-item draggable="true"><figure class="canvas-image canvas-cover-image"><div class="cover-image-viewport"><img data-bound-image-path="${path}" src="${imagePath(item.src)}" alt="" draggable="false" style="object-position:${esc(item.position || 'center')};transform:scale(${Number(item.scale || 1)})" />${item.src ? '' : '<span class="cover-image-empty">选择图片</span>'}</div><div class="cover-image-actions"><button class="puck-image-action" type="button" aria-label="编辑裁切" title="编辑裁切" data-action="crop-home-cover" data-index="${index}" ${item.src ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" /></svg></button><label class="puck-image-action cover-image-upload" aria-label="更换图片" title="更换图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg><input type="file" accept="image/jpeg,image/png,image/webp" data-upload-path="${path}" data-upload-group="home" aria-label="从电脑选择背景图片" /></label><button class="puck-image-action" type="button" data-action="remove" data-path="homeCovers" data-index="${index}" aria-label="删除背景" title="删除背景" ${covers.length === 1 ? 'disabled' : ''}>${adminActionIcon('delete')}</button></div></figure></article>`;
  }).join('');
  const addTile = '<label class="canvas-cover-add-tile" aria-label="添加首页背景"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload-new-cover data-upload-group="home" aria-label="从电脑选择首页背景" /><span>＋</span></label>';
  return `<div class="canvas-document canvas-home"><section class="canvas-section">${hero}<div class="canvas-cover-list" data-sort-list="homeCovers">${coverCards}${addTile}</div></section></div>`;
}

function renderAbout(draft, images) {
  const facts = (draft.facts || []).map((fact, index) => `<div class="canvas-fact" data-sort-list="facts" data-sort-path="facts" data-sort-index="${index}" data-sort-item draggable="true">${editable('span', '', fact.period, `facts.${index}.period`, { label: '经历时间' })}${editable('span', '', fact.text, `facts.${index}.text`, { label: '经历内容' })}<button class="drag-handle" type="button" draggable="true" aria-label="拖动经历">⠿</button><button class="remove-inline" type="button" data-action="remove" data-path="facts" data-index="${index}" aria-label="删除经历">${adminActionIcon('delete')}</button></div>`).join('');
  const bio = (key, title, lang) => {
    const suffix = key === 'biographyJa' ? 'Ja' : 'Zh';
    const style = Object.entries(biographyTextStyle(draft, suffix))
      .filter(([, value]) => value !== undefined)
      .map(([property, value]) => `${property}:${value}`).join(';');
    return `<section class="canvas-bio"><div class="bio-copy js-edit-on-double-click" lang="${lang}" style="${esc(style)}" data-bio-copy="${key}" tabindex="0" aria-label="${title}正文，双击编辑">${(draft[key] || []).map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}</div></section>`;
  };
  return `<div class="canvas-document canvas-about"><section class="about-page"><figure class="portrait canvas-portrait"><img data-bound-image-path="portrait" src="${imagePath(draft.portrait)}" alt="Portrait of ${esc(draft.romanizedName)}" /><div class="cover-image-actions">
    <button class="puck-image-action" type="button" data-action="crop-portrait" aria-label="裁切照片" title="裁切照片" ${draft.portrait ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12"/></svg></button>
    <label class="puck-image-action cover-image-upload" title="更换照片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3"/></svg><input type="file" accept="image/jpeg,image/png,image/webp" data-upload-path="portrait" data-upload-group="about" aria-label="更换照片" /></label>
    </div></figure><div class="about-content"><header class="about-profile"><h1>${editable('span', '', draft.name, 'name', { label: '姓名' })} <span>${editable('span', '', draft.romanizedName, 'romanizedName', { label: '罗马字姓名' })}</span></h1><dl><div class="canvas-facts" data-sort-list="facts">${facts}</div></dl></header><div class="canvas-bio-preview">${images.bioLanguage === 'Zh' ? bio('biographyZh', 'Chinese', 'zh') : bio('biographyJa', 'Japanese', 'ja')}</div></div></section></div>`;
}

function renderContact(draft) {
  return `<div class="canvas-document canvas-contact"><section class="contact-page" aria-label="Contact"><div class="contact-list"><div class="contact-row"><span class="contact-icon">${CONTACT_ICONS.wechat}</span><p class="contact-text">wechat: ${editable('span', '', draft.wechat, 'wechat', { label: '微信账号' })}</p></div><div class="contact-row"><span class="contact-icon">${CONTACT_ICONS.instagram}</span><p class="contact-text">instagram: ${editable('span', '', draft.instagram, 'instagram', { label: 'Instagram 用户名' })}</p></div><div class="contact-row"><span class="contact-icon">${CONTACT_ICONS.email}</span><p class="contact-text">email: ${editable('span', '', draft.email, 'email', { label: 'Email 地址' })}</p></div></div></section></div>`;
}

function deleteWorkButton(work, category) {
  const label = category.kind === 'research' ? '删除研究文章' : '删除作品';
  return `<button type="button" class="admin-icon-button" data-action="delete-work" data-category="${esc(category.slug)}" data-slug="${esc(work.slug)}" aria-label="${label}：${esc(work.title)}" title="${label}">${adminActionIcon('delete')}</button>`;
}

function renderWorkGrid(category, categoryIndex, inlineSettings = false) {
  const settings = categoryProperties(category, categoryIndex, inlineSettings);
  if (category.kind === 'research') {
    const rows = (category.works || []).map((work, index) => `<article class="research-item canvas-research-item" data-sort-list="works" data-sort-path="works" data-category-slug="${esc(category.slug)}" data-sort-index="${index}" data-sort-item draggable="true"><div class="canvas-research-row"><span class="canvas-research-title">${esc(work.title)}</span><button class="drag-handle" type="button" draggable="true" aria-label="拖动研究条目">⠿</button><button type="button" class="admin-icon-button" data-action="select-work" data-category="${esc(category.slug)}" data-slug="${esc(work.slug)}" aria-label="编辑研究条目" title="编辑研究条目">${adminActionIcon('edit')}</button>${deleteWorkButton(work, category)}</div></article>`).join('');
    return `<section class="canvas-category canvas-research-category">${categoryHeading(category, categoryIndex, inlineSettings ? settings : '')}${inlineSettings ? '' : settings}<div class="research-list" data-sort-list="works">${rows}</div></section>`;
  }
  return `<section class="canvas-category" data-sort-list="works" data-category-slug="${esc(category.slug)}">${categoryHeading(category, categoryIndex, inlineSettings ? settings : '')}${inlineSettings ? '' : settings}<div class="work-grid" ${category.kind === 'masonry' ? 'data-work-masonry' : ''}>${(category.works || []).map((work, index) => `<article class="work-card canvas-work-card" ${category.kind === 'masonry' ? `data-thumb-crop="${esc(JSON.stringify(work.masonryThumbnail || {}))}"` : ''} data-thumb-aspect="${category.kind === 'masonry' ? work.masonryThumbnail?.aspect || '' : 1}" style="${esc(thumbnailStyle(workThumbnail(work, category.kind)))}" data-sort-list="works" data-sort-path="works" data-category-slug="${esc(category.slug)}" data-sort-index="${index}" data-sort-item draggable="true"><div class="work-image-wrap">${work.image ? `<img src="${imagePath(work.image)}" alt="${esc(work.title)}" />` : '<span class="canvas-missing-image">尚未添加缩略图</span>'}<div class="canvas-work-card-actions"><button class="drag-handle" type="button" draggable="true" aria-label="拖动作品顺序">⠿</button><button class="admin-icon-button" type="button" data-action="select-work" data-category="${esc(category.slug)}" data-slug="${esc(work.slug)}" aria-label="编辑${esc(work.title)}" title="编辑作品">${adminActionIcon('edit')}</button>${deleteWorkButton(work, category)}</div></div></article>`).join('')}</div></section>`;
}

function categoryProperties(category, index, inline = false) {
  const remove = category.works?.length ? '' : `<button class="delete-button" type="button" data-action="delete-category" data-slug="${esc(category.slug)}">删除空分类</button>`;
  const settings = `<label class="canvas-field"><select aria-label="列表展示方式" data-path="${index}.kind"><option value="grid" ${category.kind === 'grid' ? 'selected' : ''}>网格式</option><option value="masonry" ${category.kind === 'masonry' ? 'selected' : ''}>瀑布式</option><option value="research" ${category.kind === 'research' ? 'selected' : ''}>展开式</option></select></label>${remove}`;
  if (inline) return `<div class="canvas-properties category-properties-inline">${settings}</div>`;
  return `<details class="canvas-properties"><summary>分类设置</summary><div class="category-settings-panel">${settings}</div></details>`;
}

function categoryHeading(category, index, settings = '') {
  return `<header class="canvas-category-header"><div class="canvas-category-heading-left"><h2>${editable('span', '', category.title, `${index}.title`, { label: '分类名称' })}<span class="canvas-category-count">（${(category.works || []).length}）</span></h2></div>${settings}</header>`;
}

function renderCategories(categories) {
  return `<div class="canvas-document canvas-categories"><div class="canvas-category-list">${categories.map((category, index) => renderWorkGrid(category, index, true)).join('')}</div></div>`;
}

export function renderCanvas(container, section, draft, selectedCategory, images = {}) {
  if (!container) return;
  stopMasonry();
  container.innerHTML = '';
  if (!draft) return;
  if (section === 'site') container.innerHTML = renderHome(draft, images);
  else if (section === 'about') container.innerHTML = renderAbout(draft, images);
  else if (section === 'contact') container.innerHTML = renderContact(draft);
  else if (section === 'categories') container.innerHTML = renderCategories(draft);
  else if (section === 'work') container.innerHTML = `<div class="canvas-document">${renderWorkGrid(selectedCategory || { slug: '', title: '作品', works: [] }, 0)}</div>`;
  stopMasonry = observeWorkMasonry(container);
}
