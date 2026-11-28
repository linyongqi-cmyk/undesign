import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hasWorkLink, rewriteWorkLinks } from '../../src/lib/content/rewrite-work-links.js';
import { videoEmbedSource } from '../../src/lib/content/video-embed.js';

// Local editor sessions protect media still reachable by undo/redo. Union across tabs;
// protection lasts until the dev server restarts, so another tab cannot prune it.
const historyMedia = new Map();
const contentBatches = new Map();
export function retainHistoryMedia(rootDir, paths) {
  if (!Array.isArray(paths) || paths.length > 100000 || paths.some((value) => typeof value !== 'string' || value.length > 1024)) throw new Error('Invalid history media paths.');
  const root = path.resolve(rootDir);
  const retained = historyMedia.get(root) ?? new Set();
  for (const value of paths) {
    if (/^(?:images|videos)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')) retained.add(value);
  }
  historyMedia.set(root, retained);
}
function retainedByHistory(rootDir, mediaPath) { return historyMedia.get(path.resolve(rootDir))?.has(mediaPath); }

function pendingMediaFile(rootDir) { return path.join(rootDir, '.local-admin', 'pending-media.json'); }
function readPendingMedia(rootDir) {
  const filePath = pendingMediaFile(rootDir);
  if (!existsSync(filePath)) return new Set();
  try {
    const values = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(values)) return new Set();
    return new Set(values.filter((value) => typeof value === 'string'
      && /^(?:images\/(?:home|about|works\/[a-z0-9-]+)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp|gif)|videos\/works\/[a-z0-9-]+\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:mp4|mov|m4v|webm|ogv))$/i.test(value)));
  } catch {
    // An unreadable protection file is treated as unknown: do not prune media.
    return null;
  }
}
function writePendingMedia(rootDir, paths) {
  atomicJsonWrite(pendingMediaFile(rootDir), [...paths].sort());
}
function registerPendingMedia(rootDir, mediaPath) {
  const pending = readPendingMedia(rootDir);
  if (!pending) throw new Error('Uploaded media protection could not be read.');
  pending.add(mediaPath);
  writePendingMedia(rootDir, pending);
}
function pendingMediaContains(rootDir, mediaPath) {
  const pending = readPendingMedia(rootDir);
  return pending === null || pending.has(mediaPath);
}
function retireSavedPendingMedia(rootDir) {
  const pending = readPendingMedia(rootDir);
  if (!pending || !pending.size) return;
  const savedImages = collectImageReferences(rootDir);
  const savedVideos = collectVideoReferences([readAllContent(rootDir), listTrashedWorks(rootDir)]);
  const saved = new Set([...savedImages, ...savedVideos]);
  const remaining = [...pending].filter((mediaPath) => !saved.has(mediaPath));
  if (remaining.length !== pending.size) writePendingMedia(rootDir, remaining);
}

const CONTENT_ROOT = path.join('src', 'data', 'content');
const ALLOWED_IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Map([['.mp4', ['video/mp4']], ['.mov', ['video/quicktime']], ['.m4v', ['video/x-m4v', 'video/mp4']], ['.webm', ['video/webm']], ['.ogv', ['video/ogg']]]);
const VALID_TEMPLATES = new Set(['splitDetail', 'articleReading', 'photographyGallery', 'photographyGallery2']);
const VALID_BLOCKS = new Set(['richText', 'paragraph', 'subheading', 'note', 'internalLink', 'externalLink', 'imageWithCaption', 'imagePair', 'mediaComposition', 'imageCarousel', 'quote', 'link', 'specifications', 'localVideo', 'videoEmbed', 'wideMedia', 'componentGroup', 'layoutGroup', 'sourceCard', 'freeSizeGroup']);

function safeSlug(value, label = 'slug') {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function insideRoot(rootDir, filePath) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(filePath));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path is outside the project root.');
  return filePath;
}

function safeGroup(group) {
  if (group === 'home' || group === 'about') return group;
  const match = typeof group === 'string' && group.match(/^works\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) throw new Error('Invalid image folder.');
  return `works/${safeSlug(match[1], 'category')}`;
}

function imageFolder(rootDir, group) {
  const normalizedGroup = safeGroup(group);
  const folder = path.join(rootDir, 'public', 'images', ...normalizedGroup.split('/'));
  insideRoot(rootDir, folder);
  return { folder, normalizedGroup };
}

export function resolveContentFile(rootDir, section, segments = []) {
  const base = path.join(rootDir, CONTENT_ROOT);
  let filePath;
  if (['site', 'about', 'contact', 'categories'].includes(section) && segments.length === 0) {
    filePath = path.join(base, `${section}.json`);
  } else if (section === 'work' && segments.length === 2) {
    filePath = path.join(base, 'works', safeSlug(segments[0], 'category'), `${safeSlug(segments[1], 'work')}.json`);
  } else {
    throw new Error('Invalid content section.');
  }
  return insideRoot(rootDir, filePath);
}

export function contentRecordVersion(rootDir, section, segments = []) {
  const filePath = resolveContentFile(rootDir, section, segments);
  if (!existsSync(filePath)) return null;
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function assertContentRecordVersion(rootDir, section, segments, expected) {
  if (expected === undefined) return;
  const actual = contentRecordVersion(rootDir, section, segments) ?? 'missing';
  if (expected !== actual) {
    const record = section === 'work' ? `作品 ${segments[0]}/${segments[1]}` : section;
    const error = new Error(`${record}已被其他管理标签页更新。草稿仍保留，请重新读取后比较并提交。`);
    error.status = 409;
    error.record = record;
    throw error;
  }
}

function allContentVersions(rootDir, allWorks) {
  const versions = Object.fromEntries(['site', 'about', 'contact', 'categories'].map((section) => [section, contentRecordVersion(rootDir, section)]));
  for (const work of allWorks) versions[`work/${work.category}/${work.slug}`] = contentRecordVersion(rootDir, 'work', [work.category, work.slug]);
  return versions;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function atomicJsonWrite(filePath, value) {
  const folder = path.dirname(filePath);
  mkdirSync(folder, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  renameSync(tempPath, filePath);
}

function walkFiles(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(folder, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : entry.isFile() ? [filePath] : [];
  });
}
function contentBatchMarker(rootDir) { return path.join(rootDir, '.local-admin', 'active-batch.json'); }
function snapshotContentBatch(rootDir, id) {
  const contentRoot = path.join(rootDir, CONTENT_ROOT);
  const contentFiles = Object.fromEntries(walkFiles(contentRoot).filter((file) => file.endsWith('.json'))
    .map((file) => [path.relative(rootDir, file), readFileSync(file, 'utf8')]));
  const pendingPath = pendingMediaFile(rootDir);
  const publicRoot = path.join(rootDir, 'public');
  const mediaFiles = walkFiles(path.join(publicRoot, 'images')).concat(walkFiles(path.join(publicRoot, 'videos')))
    .map((file) => path.relative(publicRoot, file).split(path.sep).join('/'));
  return { id, contentFiles, mediaFiles, pendingMedia: existsSync(pendingPath) ? readFileSync(pendingPath, 'utf8') : null };
}
function restoreContentBatch(rootDir, snapshot) {
  const contentRoot = path.join(rootDir, CONTENT_ROOT);
  const savedFiles = new Set(Object.keys(snapshot.contentFiles));
  for (const file of walkFiles(contentRoot).filter((item) => item.endsWith('.json'))) {
    if (!savedFiles.has(path.relative(rootDir, file))) rmSync(file, { force: true });
  }
  for (const [relative, contents] of Object.entries(snapshot.contentFiles)) {
    const file = path.join(rootDir, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents, 'utf8');
  }
  const publicRoot = path.join(rootDir, 'public');
  const savedMedia = new Set(snapshot.mediaFiles);
  for (const file of [...walkFiles(path.join(publicRoot, 'images')), ...walkFiles(path.join(publicRoot, 'videos'))]) {
    const relative = path.relative(publicRoot, file).split(path.sep).join('/');
    if (!savedMedia.has(relative)) rmSync(file, { force: true });
  }
  const pendingPath = pendingMediaFile(rootDir);
  if (snapshot.pendingMedia === null) rmSync(pendingPath, { force: true });
  else { mkdirSync(path.dirname(pendingPath), { recursive: true }); writeFileSync(pendingPath, snapshot.pendingMedia, 'utf8'); }
}
export function recoverAbandonedContentBatch(rootDir) {
  const marker = contentBatchMarker(rootDir);
  if (!existsSync(marker) || contentBatches.has(path.resolve(rootDir))) return;
  let snapshot;
  try { snapshot = JSON.parse(readFileSync(marker, 'utf8')); } catch { throw new Error('无法读取管理页保存事务的回退快照。'); }
  restoreContentBatch(rootDir, snapshot);
  rmSync(marker, { force: true });
}
export function beginContentBatch(rootDir) {
  const root = path.resolve(rootDir);
  recoverAbandonedContentBatch(root);
  if (contentBatches.has(root)) {
    const error = new Error('已有一项管理页保存正在进行，请稍后重试。');
    error.status = 409;
    throw error;
  }
  const snapshot = snapshotContentBatch(root, randomUUID());
  atomicJsonWrite(contentBatchMarker(root), snapshot);
  contentBatches.set(root, snapshot);
  return { id: snapshot.id };
}
export function assertContentBatchRequest(rootDir, id) {
  const snapshot = contentBatches.get(path.resolve(rootDir));
  if ((snapshot && snapshot.id !== id) || (!snapshot && id)) {
    const error = new Error('另一管理标签页正在保存，或保存事务已失效。请重新读取内容后重试。');
    error.status = 409;
    throw error;
  }
}
export function rollbackContentBatch(rootDir, id) {
  const root = path.resolve(rootDir);
  const marker = contentBatchMarker(root);
  if (!existsSync(marker)) return false;
  const snapshot = JSON.parse(readFileSync(marker, 'utf8'));
  if (snapshot.id !== id) return false;
  restoreContentBatch(root, snapshot);
  rmSync(marker, { force: true });
  contentBatches.delete(root);
  return true;
}
export function commitContentBatch(rootDir, id) {
  const root = path.resolve(rootDir);
  const snapshot = contentBatches.get(root);
  if (!snapshot || snapshot.id !== id) throw new Error('保存事务已失效，请重新读取内容后重试。');
  rmSync(contentBatchMarker(root), { force: true });
  contentBatches.delete(root);
  try { pruneOrphanImages(root); pruneOrphanVideos(root); return { committed: true }; }
  catch (error) { return { committed: true, cleanupWarning: error.message || '内容已保存，但清理未完成。' }; }
}

export function validateContentBatch(rootDir, records, removed = [], expectedVersions = {}) {
  if (!Array.isArray(records) || records.length > 10000 || !Array.isArray(removed)) throw new Error('保存清单格式无效。');
  const current = readAllContent(rootDir);
  const categoryRecord = records.find((record) => record?.section === 'categories');
  const categories = categoryRecord?.value || current.categories.map(({ works, ...category }) => category);
  const workKeys = new Set(current.categories.flatMap((category) => category.works.map((work) => `${work.category}/${work.slug}`)));
  for (const key of removed) if (typeof key === 'string') workKeys.delete(key.replace(/^work\//, ''));
  for (const entry of records) if (entry?.section === 'work' && Array.isArray(entry.segments) && entry.segments.length === 2) {
    workKeys.add(`${entry.segments[0]}/${entry.segments[1]}`);
  }
  const view = { categories, workKeys };
  for (const entry of records) {
    if (!entry || !['site', 'about', 'contact', 'categories', 'work'].includes(entry.section) || !Array.isArray(entry.segments)) throw new Error('保存清单中包含无效记录。');
    const key = entry.section === 'work' ? `work/${entry.segments.join('/')}` : entry.section;
    assertContentRecordVersion(rootDir, entry.section, entry.segments, expectedVersions[key]);
    try { validateRecord(rootDir, entry.section, entry.segments, structuredClone(entry.value), view); }
    catch (error) { throw new Error(`${key}：${error.message}`); }
  }
  for (const key of removed) {
    if (typeof key !== 'string' || !/^work\/[a-z0-9-]+\/[a-z0-9-]+$/.test(key)) throw new Error('保存清单中的移除记录无效。');
    assertContentRecordVersion(rootDir, 'work', key.split('/').slice(1), expectedVersions[key]);
  }
  return { validated: records.length, removed: removed.length };
}

function validImagePath(rootDir, value) {
  if (typeof value !== 'string' || !/^images\/(?:home|about|works\/[a-z0-9-]+)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp|gif)$/i.test(value)) return false;
  const absolutePath = path.join(rootDir, 'public', ...value.split('/'));
  return insideRoot(rootDir, absolutePath) && existsSync(absolutePath);
}

function validateText(value, label, { optional = false } = {}) {
  if (optional && (value === undefined || value === '')) return;
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
}

function validateImage(rootDir, value, expectedFolders, { optional = false } = {}) {
  if (optional && (value === undefined || value === '')) return;
  const folders = Array.isArray(expectedFolders) ? expectedFolders : [expectedFolders];
  if (!folders.some((folder) => typeof value === 'string' && value.startsWith(`${folder}/`)) || !validImagePath(rootDir, value)) {
    throw new Error('Choose an existing local image from the correct image folder.');
  }
}

function validateCrop(image) {
  if (image.hoverZoom !== undefined) {
    const value = image.hoverZoom;
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.enabled !== 'boolean' || !Number.isFinite(value.scale)
      || value.scale < 1.1 || value.scale > 2.5 || !['left', 'center', 'right'].includes(value.origin)) {
      throw new Error('Image hover settings are invalid.');
    }
  }
  if (image.cropAspect !== undefined && (!Number.isFinite(image.cropAspect) || image.cropAspect <= 0 || image.cropAspect > 10)) throw new Error('Image crop ratio is invalid.');
  if (image.cropScale !== undefined && (!Number.isFinite(image.cropScale) || image.cropScale < 1 || image.cropScale > 4)) throw new Error('Image crop scale is invalid.');
  if (image.cropPosition !== undefined && !validatePosition(image.cropPosition)) throw new Error('Image crop position is invalid.');
  if (image.mobileCropAspect !== undefined && (!Number.isFinite(image.mobileCropAspect) || image.mobileCropAspect <= 0 || image.mobileCropAspect > 10)) throw new Error('Mobile image crop ratio is invalid.');
  if (image.mobileCropScale !== undefined && (!Number.isFinite(image.mobileCropScale) || image.mobileCropScale < 1 || image.mobileCropScale > 4)) throw new Error('Mobile image crop scale is invalid.');
  if (image.mobileCropPosition !== undefined && !validatePosition(image.mobileCropPosition)) throw new Error('Mobile image crop position is invalid.');
}

function validateMobileOverride(mobile) {
  if (mobile === undefined) return;
  if (!mobile || typeof mobile !== 'object' || Array.isArray(mobile)) throw new Error('手机端排版覆写设置无效。');
  if (mobile.hidden !== undefined && typeof mobile.hidden !== 'boolean') throw new Error('手机端隐藏设置无效。');
  if (mobile.displayWidth !== undefined && (!Number.isInteger(mobile.displayWidth) || mobile.displayWidth < 10 || mobile.displayWidth > 100)) {
    throw new Error('手机端显示宽度必须是 10% 至 100%。');
  }
  if (mobile.align !== undefined && !['left', 'center', 'right'].includes(mobile.align)) throw new Error('手机端对齐方式无效。');
  if (mobile.layout !== undefined && !['stack', 'keep', 'columns2', 'scroll'].includes(mobile.layout)) throw new Error('手机端群组排列方式无效。');
}

function validateUniformCrop(images, message) {
  const aspects = images.map((image) => image.cropAspect).filter((aspect) => aspect !== undefined);
  if (aspects.some((aspect) => Math.abs(aspect - aspects[0]) > 0.000001)) throw new Error(message);
}

function validateMediaCaption(value, label) {
  validateText(value?.caption, label, { optional: true });
  if (value?.captionSettings === undefined) return;
  const settings = value.captionSettings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || !['top', 'bottom'].includes(settings.position)
    || !Number.isFinite(settings.gap) || settings.gap < 0 || settings.gap > 120) {
    throw new Error('说明的位置或间距无效。');
  }
}

function validateImageLinkLabel(image) {
  if (image?.linkLabel === undefined) return;
  const value = image.linkLabel;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.text !== 'string' || !value.text.trim()
    || typeof value.newTab !== 'boolean' || typeof value.href !== 'string' || !value.href) {
    throw new Error('图片链接文字不完整。');
  }
  validateExternalUrl(value.href, '图片链接');
}

function validateContentImage(rootDir, image, expectedFolders) {
  if (!image || typeof image !== 'object' || Array.isArray(image)) throw new Error('Image details are incomplete.');
  validateImage(rootDir, image.src, expectedFolders, { optional: true });
  validateText(image.alt, 'Image alt text', { optional: true });
  validateText(image.photographyDescription, 'Photography description', { optional: true });
  validateMediaCaption(image, 'Image caption');
  validateImageLinkLabel(image);
  validateCrop(image);
}

function validatePosition(value) {
  const positionToken = '(?:left|center|right|top|bottom|[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)%)';
  return typeof value === 'string' && new RegExp(`^${positionToken}(?:\\s+${positionToken})?$`, 'i').test(value);
}

function validateParagraphs(value, label) {
  if (typeof value === 'string') return;
  if (!Array.isArray(value) || value.some((paragraph) => typeof paragraph !== 'string')) throw new Error(`${label} must be text or a list of paragraphs.`);
}

function validateExternalUrl(value, label) {
  if (value === undefined || value === '') return;
  if (typeof value !== 'string') throw new Error(`${label}无效。`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label}无效。`); }
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error(`${label}必须使用 HTTPS 地址。`);
}

function validateWorkBlock(rootDir, categorySlug, block, view) {
  if (!VALID_BLOCKS.has(block?.kind)) throw new Error(`Unsupported detail block${block?.kind ? ` “${String(block.kind)}”` : ' (missing kind)'}.`);
  validateMobileOverride(block.mobile);
  if (block.blockIndent !== undefined && (!Number.isInteger(block.blockIndent) || block.blockIndent < 0 || block.blockIndent > 20)) {
    throw new Error('整体缩进必须是 0 至 20 个字符。');
  }
  if (block.blockIndentSize !== undefined && (!Number.isFinite(block.blockIndentSize) || block.blockIndentSize < 1 || block.blockIndentSize > 200)) {
    throw new Error('每字符宽度必须是 1 至 200px。');
  }
  if (block.displayHeight !== undefined && (!Number.isInteger(block.displayHeight) || block.displayHeight < 80 || block.displayHeight > 1200)) throw new Error('图片高度须为 80–1200px。');
  if (block.displayWidth !== undefined && (!Number.isInteger(block.displayWidth) || block.displayWidth < 10 || block.displayWidth > 200)) {
    throw new Error('显示宽度必须是 10% 至 200%。');
  }
  if (block.kind === 'componentGroup' || block.kind === 'layoutGroup') {
    if (block.kind === 'layoutGroup' && !['column', 'row', 'overflow', 'side'].includes(block.layout)) throw new Error('群组排列方式无效。');
    if (!Array.isArray(block.items) || !block.items.length) throw new Error('群组至少需要一个组件。');
    if (block.layout === 'side') {
      if (block.sideAlign !== undefined && !['top', 'bottom'].includes(block.sideAlign)) throw new Error('右侧垂直对齐设置无效。');
      if (block.sideMatchHeight !== undefined && typeof block.sideMatchHeight !== 'boolean') throw new Error('右侧媒体对齐设置无效。');
      if (!Array.isArray(block.sideItems)) throw new Error('右侧内容无效。');
      if (block.sideGap !== undefined && (!Number.isInteger(block.sideGap) || block.sideGap < 0 || block.sideGap > 120)) {
        throw new Error('右侧间距必须是 0 至 120 px。');
      }
    }
    for (const [index, item] of [...block.items, ...(block.layout === 'side' ? block.sideItems : [])].entries()) {
      try {
        validateWorkBlock(rootDir, categorySlug, item, view);
      } catch (error) {
        throw new Error(`群组内第 ${index + 1} 个组件：${error.message}`);
      }
    }
    return;
  }
  if (['richText', 'paragraph', 'note'].includes(block.kind)) validateParagraphs(block.text, 'Paragraph content');
  if (block.kind === 'subheading') validateText(block.text || '', '正文小标题');
  if (block.kind === 'imageWithCaption') {
    if (!block.image || typeof block.image !== 'object') throw new Error('Image block details are incomplete.');
    validateContentImage(rootDir, block.image, 'images/works');
  }
  if (block.kind === 'imagePair') {
    if (!Array.isArray(block.images) || block.images.length !== 2) throw new Error('Image combinations must contain exactly two images.');
    for (const image of block.images) validateContentImage(rootDir, image, 'images/works');
    validateUniformCrop(block.images, 'Both images in a combination must use the same crop ratio.');
  }
  if (block.kind === 'imageCarousel') {
    if (!Array.isArray(block.images)) throw new Error('Image carousels must contain a list of images.');
    for (const image of block.images) validateContentImage(rootDir, image, 'images/works');
    validateUniformCrop(block.images, 'All carousel images must use the same crop ratio.');
    validateMediaCaption(block, 'Carousel caption');
  }
  if (block.kind === 'sourceCard') {
    validateText(block.text, '来源说明');
    validateText(block.linkText, '出典链接显示文字', { optional: true });
    validateExternalUrl(block.href, '免责声明链接');
    validateMediaCaption(block, 'Source card caption');
  }
  if (block.kind === 'freeSizeGroup') {
    if (block.overflowRight !== undefined && typeof block.overflowRight !== 'boolean') throw new Error('自由尺寸组超宽度设置无效。');
    if (!['work', 'research'].includes(block.mode)) throw new Error('自由尺寸组模式无效。');
    if (block.height !== undefined && (!Number.isFinite(block.height) || block.height < 40 || block.height > 3000)) throw new Error('自由尺寸组高度需在 40 至 3000 px 之间。');
    if (!Array.isArray(block.items) || !block.items.length) throw new Error('自由尺寸组至少需要一个媒体项目。');
    if (block.anchorItemId !== undefined && !block.items.some((item) => item.id === block.anchorItemId)) throw new Error('自由尺寸组基准项目无效。');
    for (const item of block.items) {
      if (!item || typeof item.id !== 'string' || !item.id || !['image', 'imageCarousel', 'localVideo', 'videoEmbed', 'sourceCard', 'component'].includes(item.kind)) throw new Error('自由尺寸组媒体项目无效。');
      validateMobileOverride(item.mobile);
      if (item.kind === 'component') validateWorkBlock(rootDir, categorySlug, item.block, view);
      if (item.kind === 'image') {
        if (!item.image?.src) throw new Error('自由尺寸组图片项目缺少图片。');
        validateContentImage(rootDir, item.image, 'images/works');
      }
      if (item.kind === 'imageCarousel') {
        if (!Array.isArray(item.images) || !item.images.some((image) => image?.src)) throw new Error('自由尺寸组轮播需要至少一张图片。');
        for (const image of item.images) validateContentImage(rootDir, image, 'images/works');
      }
      if (item.kind === 'localVideo') {
        if (typeof item.src !== 'string' || !new RegExp(`^videos/works/${categorySlug}/[a-zA-Z0-9][a-zA-Z0-9._-]*\\.(?:mp4|mov|m4v|webm|ogv)$`, 'i').test(item.src)) throw new Error('自由尺寸组本地视频无效。');
        const absolutePath = path.join(rootDir, 'public', ...item.src.split('/'));
        insideRoot(rootDir, absolutePath);
        if (!existsSync(absolutePath)) throw new Error('自由尺寸组本地视频不存在。');
        validateMediaCaption(item, 'Video caption');
      }
      if (item.kind === 'videoEmbed') {
        validateText(item.url, '视频链接');
        let parsed;
        try { parsed = new URL(item.url); } catch { throw new Error('视频链接无效。'); }
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (parsed.protocol !== 'https:' || !['youtube.com', 'youtu.be', 'bilibili.com', 'b23.tv'].some((domain) => host === domain || host.endsWith(`.${domain}`))) throw new Error('只支持 YouTube 和 Bilibili 视频链接。');
        validateMediaCaption(item, 'Video caption');
      }
      if (item.kind === 'sourceCard') { validateText(item.text, '来源说明'); validateText(item.linkText, '出典链接显示文字', { optional: true }); validateExternalUrl(item.href, '免责声明链接'); validateMediaCaption(item, 'Source card caption'); }
      if (item.kind === 'imageCarousel') validateMediaCaption(item, 'Carousel caption');
    }
  }
  if (block.kind === 'mediaComposition') {
    // New split-detail compositions store independent vertical stacks in
    // `columns`; keep accepting the old flat `items` representation too.
    const columns = Array.isArray(block.columns)
      ? block.columns
      : Array.isArray(block.items) ? [{ items: block.items }] : null;
    if (block.overflowSettings !== undefined) {
      const { align, gap, textWidth } = block.overflowSettings || {};
      if (!block.overflowSettings || typeof block.overflowSettings !== 'object' || Array.isArray(block.overflowSettings)
        || (align !== undefined && !['top', 'bottom', 'stretch'].includes(align))
        || (gap !== undefined && !['default', 'media'].includes(gap) && !(Number.isFinite(gap) && gap >= 0))
        || (textWidth !== undefined && textWidth !== 'auto' && !(Number.isFinite(textWidth) && textWidth >= 0 && textWidth <= 100))) {
        throw new Error('超宽内容的对齐、间距或文字宽度设置无效。');
      }
    }
    if (!columns?.length) throw new Error('A media composition must contain at least one column.');
    if (block.stackOnMobile !== undefined && typeof block.stackOnMobile !== 'boolean') throw new Error('Mobile stacking must be enabled or disabled.');
    for (const column of columns) {
      if (!column || typeof column !== 'object' || !Array.isArray(column.items)) throw new Error('Media composition columns must contain an image list.');
      for (const item of column.items) {
        if (!item || typeof item !== 'object') throw new Error('Media composition items are incomplete.');
        validateMobileOverride(item.mobile);
        if (item.kind === 'component') validateWorkBlock(rootDir, categorySlug, item.block, view);
        if (item.kind === 'image') validateContentImage(rootDir, item.image, 'images/works');
        else if (item.kind === 'imageCarousel') {
          if (!Array.isArray(item.images) || item.images.length < 1) throw new Error('A composition carousel needs at least one image.');
          for (const image of item.images) validateContentImage(rootDir, image, 'images/works');
          validateUniformCrop(item.images, 'All carousel images must use the same crop ratio.');
          validateMediaCaption(item, 'Carousel caption');
        } else if (item.kind === 'content') validateWorkBlock(rootDir, categorySlug, item.block, view);
        else throw new Error('Unsupported media composition item.');
      }
    }
  }
  if (block.kind === 'localVideo') {
    const videoPath = block.src;
    if (typeof videoPath !== 'string' || !new RegExp(`^videos/works/${categorySlug}/[a-zA-Z0-9][a-zA-Z0-9._-]*\\.(?:mp4|mov|m4v|webm|ogv)$`, 'i').test(videoPath)) throw new Error('Choose a supported local video file.');
    const absolutePath = path.join(rootDir, 'public', ...videoPath.split('/'));
    insideRoot(rootDir, absolutePath);
    if (!existsSync(absolutePath)) throw new Error('The local video file was not found.');
    validateMediaCaption(block, 'Video caption');
  }
  if (block.kind === 'videoEmbed') {
    validateText(block.url, 'Video URL');
    if (!videoEmbedSource(block.url)) throw new Error('Only supported YouTube and Bilibili video links are allowed.');
    validateMediaCaption(block, 'Video caption');
  }
  if (block.kind === 'wideMedia') {
    if (!Array.isArray(block.items)) throw new Error('Wide media needs an image list.');
    for (const image of block.items) validateContentImage(rootDir, image, 'images/works');
    validateText(block.caption, 'Wide media caption', { optional: true });
  }
  if (block.kind === 'quote') validateText(block.quote, 'Quote');
  if (block.kind === 'specifications') {
    if (block.items !== undefined && (!Array.isArray(block.items) || block.items.some((item) => !item || typeof item !== 'object' || Array.isArray(item)))) throw new Error('Work parameters must be a list of editable label and value rows.');
    for (const item of block.items || []) {
      validateText(item.label, 'Parameter label');
      validateText(item.value, 'Parameter value');
    }
    validateText(block.dimensions, 'Dimensions', { optional: true });
    validateText(block.material, 'Material', { optional: true });
    validateText(block.date, 'Date', { optional: true });
  }
  if (block.kind === 'link') {
    validateText(block.linkLabel, 'Link text');
    validateText(block.linkHref, 'Link address');
    if (!(block.linkHref.startsWith('/') && !block.linkHref.startsWith('//') || block.linkHref.startsWith('https://'))) throw new Error('Links must use an internal path or HTTPS address.');
    if (block.linkHref.startsWith('/') && !block.linkHref.startsWith('//')) {
      const parsed = new URL(block.linkHref, 'https://portfolio.invalid');
      const categories = view?.categories || readJson(path.join(rootDir, CONTENT_ROOT, 'categories.json'));
      const categoryPath = parsed.pathname.match(/^\/works\/([a-z0-9-]+)\/?$/);
      const workPath = parsed.pathname.match(/^\/works\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
      const researchAnchor = parsed.pathname.match(/^\/works\/research\/?$/) && parsed.hash.match(/^#research-([a-z0-9-]+)$/);
      if (categoryPath && !categories.some((category) => category.slug === categoryPath[1])) throw new Error('链接目标分类不存在。');
      const target = workPath ? [workPath[1], workPath[2]] : researchAnchor ? ['research', researchAnchor[1]] : null;
      if (target) {
        const exists = view?.workKeys?.has(`${target[0]}/${target[1]}`)
          ?? existsSync(path.join(rootDir, CONTENT_ROOT, 'works', target[0], `${target[1]}.json`));
        if (!exists) throw new Error('链接目标作品不存在。');
      }
    }
  }
  if (block.kind === 'internalLink') {
    validateText(block.text, 'Link text');
    if (['@home', '@about', '@contact'].includes(block.category)) return;
    const categories = view?.categories || readJson(path.join(rootDir, CONTENT_ROOT, 'categories.json'));
    const targetCategory = categories.find((item) => item.slug === block.category);
    if (!targetCategory) throw new Error('Choose an existing site category for the internal link.');
    if (block.workSlug !== undefined) {
      safeSlug(block.workSlug, 'work');
      const workPath = path.join(rootDir, CONTENT_ROOT, 'works', targetCategory.slug, `${block.workSlug}.json`);
      if (!(view?.workKeys?.has(`${targetCategory.slug}/${block.workSlug}`) ?? existsSync(workPath))) throw new Error('Choose an existing work for the internal link.');
    }
  }
  if (block.kind === 'externalLink') {
    validateText(block.text, 'Link text');
    validateText(block.href, 'Link address');
    if (!/^https:\/\//i.test(block.href)) throw new Error('External links must use HTTPS.');
    if (block.newTab !== undefined && typeof block.newTab !== 'boolean') throw new Error('External link tab behavior is invalid.');
  }
}

function normalizeTextBlock(block) {
  if (VALID_BLOCKS.has(block?.kind)) return block;
  const candidates = [block?.text, block?.content, block?.value, block?.props?.text, block?.props?.content];
  const rawText = candidates.find((value) => typeof value === 'string' || Array.isArray(value));
  if (rawText === undefined) return block;
  const text = typeof rawText === 'string'
    ? rawText
    : rawText.map((item) => typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : '').filter((item) => item !== '');
  return { kind: 'paragraph', text };
}

function normalizeWorkTextBlocks(record) {
  return {
    ...record,
    sections: record.sections.map(normalizeTextBlock),
    ...(Array.isArray(record.leftSections) ? { leftSections: record.leftSections.map(normalizeTextBlock) } : {}),
    ...(Array.isArray(record.photographyGallery2Sections) ? { photographyGallery2Sections: record.photographyGallery2Sections.map(normalizeTextBlock) } : {}),
  };
}

function validateRecord(rootDir, section, segments, record, view) {
  if (section === 'categories') {
    if (!Array.isArray(record) || !record.length) throw new Error('Keep at least one category.');
    const seen = new Set();
    for (const [index, category] of record.entries()) {
      if (!category || typeof category !== 'object') throw new Error('Category entries are incomplete.');
      safeSlug(category.slug, 'category');
      if (seen.has(category.slug) || typeof category.title !== 'string' || !category.title || !['grid', 'masonry', 'research'].includes(category.kind)) throw new Error('Category entries must have unique IDs, titles, and valid kinds.');
      seen.add(category.slug);
      category.order = index;
    }
    return;
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Content must be a JSON object.');
  if (section === 'site') {
    validateText(record.siteTitle, 'Website title');
    validateImage(rootDir, record.favicon, 'images/home', { optional: true });
    validateText(record.description, 'Website description', { optional: true });
    if (!Array.isArray(record.homeCovers) || record.homeCovers.length < 1) throw new Error('Add at least one home background image.');
    // Browser number inputs and older saved drafts may arrive as numeric strings.
    // Normalize once at the storage boundary so validation and subsequent reads agree.
    const rotationSeconds = record.rotationSeconds === '' ? NaN : Number(record.rotationSeconds);
    if (!Number.isFinite(rotationSeconds) || rotationSeconds < 0.1 || rotationSeconds > 60) throw new Error('首页背景轮播间隔须为 0.1–60 秒。');
    record.rotationSeconds = rotationSeconds;
    if (record.imageCarouselSeconds !== undefined) {
      const imageCarouselSeconds = record.imageCarouselSeconds === '' ? NaN : Number(record.imageCarouselSeconds);
      if (!Number.isFinite(imageCarouselSeconds) || imageCarouselSeconds < 0.1 || imageCarouselSeconds > 5) {
        throw new Error('Image carousel time must be between 0.1 and 5 seconds.');
      }
      record.imageCarouselSeconds = imageCarouselSeconds;
    }
    if (record.randomHomeCover !== undefined && typeof record.randomHomeCover !== 'boolean') throw new Error('Random first cover must be enabled or disabled.');
    if (record.adaptiveFavicon !== undefined && typeof record.adaptiveFavicon !== 'boolean') throw new Error('Automatic favicon inversion must be enabled or disabled.');
    if (record.typography !== undefined) {
      const variants = ['paragraph', 'subheading', 'note', 'specifications', 'internalLink', 'externalLink'];
      const alignments = ['left', 'center', 'right', 'justify'];
      const decorations = ['none', 'underline', 'line-through'];
      for (const variant of variants) {
        const style = record.typography[variant];
        if (!style || typeof style !== 'object') throw new Error(`The ${variant} text style is incomplete.`);
        if (style.name !== undefined) validateText(style.name, 'Typography name', { optional: true });
        for (const key of ['fontFamily', 'color']) validateText(style[key], `Typography ${key}`);
        for (const key of ['fontSize', 'mobileFontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'textIndent', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
          if (style[key] === undefined && key === 'mobileFontSize') continue;
          if (!Number.isFinite(Number(style[key]))) throw new Error(`Typography ${key} must be numeric.`);
        }
        if (!alignments.includes(style.textAlign) || !decorations.includes(style.textDecoration) || !['normal', 'italic'].includes(style.fontStyle) || !['none', 'uppercase', 'lowercase', 'capitalize'].includes(style.textTransform) || (style.writingMode !== undefined && !['horizontal-tb', 'vertical-rl'].includes(style.writingMode))) throw new Error('Typography options are invalid.');
      }
    }
    for (const cover of record.homeCovers) {
      if (!cover || typeof cover !== 'object') throw new Error('Home background details are incomplete.');
      validateImage(rootDir, cover.src, ['images/home', 'images/works']);
      validateText(cover.alt, 'Image alt text', { optional: true });
      if (!Number.isFinite(cover.scale) || cover.scale < 1 || cover.scale > 4) throw new Error('Image zoom must be between 1 and 4.');
      if (!validatePosition(cover.position)) throw new Error('Enter a valid image position, such as “center 42%”.');
      if (cover.mobileScale !== undefined && (!Number.isFinite(cover.mobileScale) || cover.mobileScale < 1 || cover.mobileScale > 4)) {
        throw new Error('Mobile image zoom must be between 1 and 4.');
      }
      if (cover.mobilePosition !== undefined && !validatePosition(cover.mobilePosition)) {
        throw new Error('Enter a valid mobile image position, such as “center 42%”.');
      }
    }
  } else if (section === 'about') {
    if (!record.name || !record.romanizedName || !Array.isArray(record.facts) || !Array.isArray(record.biographyJa) || !Array.isArray(record.biographyZh)) throw new Error('About content is incomplete.');
    validateText(record.name, 'Name');
    validateText(record.romanizedName, 'Romanized name');
    validateImage(rootDir, record.portrait, 'images/about', { optional: true });
    for (const fact of record.facts) {
      if (!fact || typeof fact !== 'object') throw new Error('Experience entries are incomplete.');
      validateText(fact.period, 'Experience date', { optional: true });
      validateText(fact.text, 'Experience description', { optional: true });
    }
    validateParagraphs(record.biographyJa, 'Japanese biography');
    validateParagraphs(record.biographyZh, 'Chinese biography');
  } else if (section === 'contact') {
    if (!record.instagram || !record.email || !record.wechat) throw new Error('Contact fields cannot be empty.');
    validateText(record.instagram, 'Instagram username');
    validateText(record.email, 'Email address');
    validateText(record.wechat, 'WeChat ID');
  } else if (section === 'work') {
    const [categorySlug, workSlug] = segments;
    safeSlug(categorySlug, 'category');
    safeSlug(workSlug, 'work');
    const categories = readJson(path.join(rootDir, CONTENT_ROOT, 'categories.json'));
    const category = categories.find((item) => item.slug === categorySlug);
    if (!category) throw new Error('Work category does not exist.');
    if (record.slug !== workSlug || record.category !== categorySlug || typeof record.title !== 'string' || !record.title || typeof record.type !== 'string') throw new Error('Work ID, category, title, or type is invalid.');
    const validTemplate = record.category === 'research'
      ? record.template === undefined || VALID_TEMPLATES.has(record.template)
      : VALID_TEMPLATES.has(record.template);
    const order = typeof record.order === 'string' && record.order.trim() ? Number(record.order) : record.order;
    if (!Number.isInteger(order) || order < 0) throw new Error('Work order must be a nonnegative integer.');
    record.order = order;
    if (!validTemplate) throw new Error('Work detail template is invalid.');
    if (record.photographyLightboxEnabled !== undefined && typeof record.photographyLightboxEnabled !== 'boolean') throw new Error('Photography lightbox must be enabled or disabled.');
    if (record.photographyIntroWidth !== undefined) {
      const photographyIntroWidth = record.photographyIntroWidth === '' ? NaN : Number(record.photographyIntroWidth);
      if (!Number.isFinite(photographyIntroWidth) || photographyIntroWidth < 10 || photographyIntroWidth > 100) throw new Error('Photography intro width must be between 10 and 100 vw.');
      record.photographyIntroWidth = photographyIntroWidth;
    }
    if (!Array.isArray(record.sections) || (record.leftSections !== undefined && !Array.isArray(record.leftSections)) || (record.photographyGallery2Sections !== undefined && !Array.isArray(record.photographyGallery2Sections))) throw new Error('Work detail blocks must be arrays.');
    if (record.category === 'research' && record.articleLanguage !== undefined && !['ja', 'zh'].includes(record.articleLanguage)) throw new Error('Research article language must be Japanese or Chinese.');
    validateImage(rootDir, record.image, 'images/works', { optional: true });
    if (record.masonryThumbnail !== undefined) {
      const crop = record.masonryThumbnail;
      if (!crop || typeof crop !== 'object' || Array.isArray(crop) || (crop.aspect !== undefined && (!Number.isFinite(crop.aspect) || crop.aspect <= 0)) || (crop.scale !== undefined && (!Number.isFinite(crop.scale) || crop.scale < 1 || crop.scale > 4)) || (crop.position !== undefined && typeof crop.position !== 'string') || ['centerX', 'centerY'].some((key) => crop[key] !== undefined && (!Number.isFinite(crop[key]) || crop[key] < 0 || crop[key] > 1))) throw new Error('瀑布流封面设置无效。');
    }
    if (record.gallery !== undefined && !Array.isArray(record.gallery)) throw new Error('Work gallery must be a list of images.');
    for (const image of record.gallery || []) {
      if (typeof image === 'string') validateImage(rootDir, image, 'images/works', { optional: true });
      else validateContentImage(rootDir, image, 'images/works');
    }
    validateText(record.description, 'Work description', { optional: true });
    for (const [field, blocks] of Object.entries({
      sections: record.sections,
      leftSections: record.leftSections || [],
      photographyGallery2Sections: record.photographyGallery2Sections || [],
    })) {
      for (const [index, block] of blocks.entries()) {
        try {
          validateWorkBlock(rootDir, categorySlug, block, view);
        } catch (error) {
          throw new Error(`${field}[${index}]（${block?.kind || '无类型'}）：${error.message}`);
        }
      }
    }
  }
}

export function parseImageUpload({ group, filename, mimeType, data, buffer: binaryBuffer }) {
  const normalizedGroup = safeGroup(group);
  const extension = typeof filename === 'string' ? path.extname(path.basename(filename)).toLowerCase() : '';
  const expectedType = ALLOWED_IMAGE_TYPES.get(extension);
  if (!expectedType || expectedType !== mimeType) throw new Error('Unsupported image format. Use JPG, PNG, WebP, or GIF.');
  let buffer;
  if (Buffer.isBuffer(binaryBuffer)) {
    buffer = binaryBuffer;
  } else {
    if (typeof data !== 'string' || !data.length || data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
      throw new Error('Image data is invalid or too large.');
    }
    buffer = Buffer.from(data, 'base64');
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 25 MB size limit.');
  const stem = path.basename(filename, path.extname(filename)).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  const relativePath = `images/${normalizedGroup}/${stem}${extension}`;
  return { relativePath, buffer };
}

export function readAllContent(rootDir) {
  const contentRoot = path.join(rootDir, CONTENT_ROOT);
  const categories = readJson(path.join(contentRoot, 'categories.json')).sort((a, b) => a.order - b.order);
  const allWorks = [];
  for (const category of categories) {
    const workRoot = path.join(contentRoot, 'works', safeSlug(category.slug, 'category'));
    if (!existsSync(workRoot)) continue;
    const works = readdirSync(workRoot).filter((name) => name.endsWith('.json'))
      .map((name) => readJson(path.join(workRoot, name)))
      .sort((a, b) => a.order - b.order);
    allWorks.push(...works);
  }
  return {
    site: readJson(path.join(contentRoot, 'site.json')),
    about: readJson(path.join(contentRoot, 'about.json')),
    contact: readJson(path.join(contentRoot, 'contact.json')),
    categories: categories.map((category) => ({ ...category, works: allWorks.filter((work) => work.category === category.slug) })),
    versions: allContentVersions(rootDir, allWorks),
  };
}

export function writeContent(rootDir, section, segments, value) {
  const filePath = resolveContentFile(rootDir, section, segments);
  const previousReferences = existsSync(filePath) ? imageReferencesIn(readJson(filePath)) : new Set();
  const normalizedValue = section === 'work' && value && typeof value === 'object'
    ? normalizeWorkTextBlocks(value)
    : value;
  validateRecord(rootDir, section, segments, normalizedValue);
  atomicJsonWrite(filePath, normalizedValue);
  retireSavedPendingMedia(rootDir);
  pruneUnusedImages(rootDir, previousReferences);
  if (section === 'work') pruneOrphanVideos(rootDir);
}

// Validate a work without writing, normalizing the caller's object, or pruning media.
export function validateWorkContent(rootDir, categorySlug, workSlug, record) {
  const normalizedRecord = normalizeWorkTextBlocks(structuredClone(record));
  validateRecord(rootDir, 'work', [categorySlug, workSlug], normalizedRecord);
  return normalizedRecord;
}

export function renameWorkRecord(rootDir, category, previousSlug, nextSlug, expectedVersions = {}) {
  safeSlug(nextSlug, '作品网址标识');
  const sourcePath = resolveContentFile(rootDir, 'work', [category, previousSlug]);
  const targetPath = resolveContentFile(rootDir, 'work', [category, nextSlug]);
  if (!existsSync(sourcePath)) throw new Error('找不到要改名的作品。');
  if (existsSync(targetPath)) throw new Error('此分类下已存在相同网址标识。');

  const work = readJson(sourcePath);
  work.slug = nextSlug;
  rewriteWorkLinks(work, category, previousSlug, nextSlug);
  const updates = [];
  for (const group of readAllContent(rootDir).categories) {
    for (const other of group.works) {
      const filePath = resolveContentFile(rootDir, 'work', [group.slug, other.slug]);
      if (filePath === sourcePath) continue;
      if (hasWorkLink(other, category, previousSlug)) assertContentRecordVersion(rootDir, 'work', [group.slug, other.slug], expectedVersions[`work/${group.slug}/${other.slug}`]);
      const original = JSON.stringify(other);
      if (rewriteWorkLinks(other, category, previousSlug, nextSlug)) {
        updates.push({ filePath, original, updated: other });
      }
    }
  }

  const written = [];
  try {
    atomicJsonWrite(targetPath, work);
    validateRecord(rootDir, 'work', [category, nextSlug], work);
    for (const { filePath, original, updated } of updates) {
      atomicJsonWrite(filePath, updated);
      written.push({ filePath, original });
    }
    rmSync(sourcePath);
    return {
      removed: [`work/${category}/${previousSlug}`],
      versions: {
        [`work/${category}/${nextSlug}`]: contentRecordVersion(rootDir, 'work', [category, nextSlug]),
        ...Object.fromEntries(updates.map(({ updated }) => [`work/${updated.category}/${updated.slug}`, contentRecordVersion(rootDir, 'work', [updated.category, updated.slug])])),
      },
    };
  } catch (error) {
    for (const { filePath, original } of written.reverse()) {
      atomicJsonWrite(filePath, JSON.parse(original));
    }
    rmSync(targetPath, { force: true });
    throw error;
  }
}

export function moveWorkRecord(rootDir, fromCategory, toCategory, workSlug, draftWork, expectedVersions = {}) {
  const sourcePath = resolveContentFile(rootDir, 'work', [fromCategory, workSlug]);
  const targetPath = resolveContentFile(rootDir, 'work', [toCategory, workSlug]);
  if (fromCategory === toCategory) throw new Error('Choose a different category.');
  if (!existsSync(sourcePath)) throw new Error('Work was not found in its current category.');
  if (existsSync(targetPath)) throw new Error('A work with this URL ID already exists in the destination category.');
  const categories = readJson(path.join(rootDir, CONTENT_ROOT, 'categories.json'));
  if (!categories.some((category) => category.slug === toCategory)) throw new Error('Destination category does not exist.');
  const sourceWork = readJson(sourcePath);
  if (draftWork && (draftWork.slug !== workSlug || draftWork.category !== toCategory)) throw new Error('移入作品的草稿信息与目标分类不匹配。');
  const work = draftWork ? JSON.parse(JSON.stringify(draftWork)) : sourceWork;
  const previousReferences = imageReferencesIn(sourceWork);
  work.category = toCategory;
  rewriteWorkLinks(work, fromCategory, workSlug, work.slug, toCategory);
  if (!Number.isInteger(work.order) || work.order < 0) {
    work.order = readAllContent(rootDir).categories.find((category) => category.slug === toCategory)?.works.length || 0;
  }

  const referenceUpdates = [];
  for (const group of readAllContent(rootDir).categories) {
    for (const other of group.works) {
      if (other.category === fromCategory && other.slug === workSlug) continue;
      if (hasWorkLink(other, fromCategory, workSlug)) assertContentRecordVersion(rootDir, 'work', [group.slug, other.slug], expectedVersions[`work/${group.slug}/${other.slug}`]);
      const original = JSON.stringify(other);
      if (rewriteWorkLinks(other, fromCategory, workSlug, work.slug, toCategory)) {
        referenceUpdates.push({ filePath: resolveContentFile(rootDir, 'work', [other.category, other.slug]), original, updated: other });
      }
    }
  }

  const copiedImages = new Map();
  const createdFiles = [];
  let targetWritten = false;
  let sourceRemoved = false;
  const rewriteImages = (value) => {
    if (Array.isArray(value)) return value.map(rewriteImages);
    if (!value || typeof value !== 'object') {
      if (typeof value !== 'string' || !value.startsWith(`images/works/${fromCategory}/`)) return value;
      if (copiedImages.has(value)) return copiedImages.get(value);
      const sourceImage = path.join(rootDir, 'public', ...value.split('/'));
      insideRoot(rootDir, sourceImage);
      if (!existsSync(sourceImage)) throw new Error(`Referenced image was not found: ${value}`);
      const originalName = path.basename(value);
      const extension = path.extname(originalName);
      const stem = path.basename(originalName, extension);
      let name = originalName;
      let index = 2;
      let targetImage = path.join(rootDir, 'public', 'images', 'works', toCategory, name);
      while (existsSync(targetImage)) {
        name = `${stem}-${index++}${extension}`;
        targetImage = path.join(rootDir, 'public', 'images', 'works', toCategory, name);
      }
      insideRoot(rootDir, targetImage);
      mkdirSync(path.dirname(targetImage), { recursive: true });
      copyFileSync(sourceImage, targetImage);
      createdFiles.push(targetImage);
      const nextValue = `images/works/${toCategory}/${name}`;
      copiedImages.set(value, nextValue);
      return nextValue;
    }
    for (const [key, item] of Object.entries(value)) value[key] = rewriteImages(item);
    return value;
  };

  try {
    rewriteImages(work);
    writeContent(rootDir, 'work', [toCategory, workSlug], work);
    targetWritten = true;
    for (const { filePath, updated } of referenceUpdates) {
      const relative = path.relative(path.join(rootDir, CONTENT_ROOT, 'works'), filePath).split(path.sep);
      validateWorkContent(rootDir, relative[0], path.basename(filePath, '.json'), updated);
    }
    for (const { filePath, updated } of referenceUpdates) atomicJsonWrite(filePath, updated);
    rmSync(sourcePath);
    sourceRemoved = true;
    pruneUnusedImages(rootDir, previousReferences);
  } catch (error) {
    for (const { filePath, original } of [...referenceUpdates].reverse()) {
      if (existsSync(filePath)) atomicJsonWrite(filePath, JSON.parse(original));
    }
    if (sourceRemoved && !existsSync(sourcePath)) atomicJsonWrite(sourcePath, sourceWork);
    if (targetWritten) rmSync(targetPath, { force: true });
    for (const filePath of createdFiles) rmSync(filePath, { force: true });
    throw error;
  }
  return {
    work,
    removed: [`work/${fromCategory}/${workSlug}`],
    versions: {
      [`work/${toCategory}/${workSlug}`]: contentRecordVersion(rootDir, 'work', [toCategory, workSlug]),
      ...Object.fromEntries(referenceUpdates.map(({ updated }) => [`work/${updated.category}/${updated.slug}`, contentRecordVersion(rootDir, 'work', [updated.category, updated.slug])])),
    },
  };
}

export function listImages(rootDir, group) {
  const { folder, normalizedGroup } = imageFolder(rootDir, group);
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => /\.(?:jpg|jpeg|png|webp|gif)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `images/${normalizedGroup}/${name}`);
}

function collectImageReferences(rootDir) {
  return imageReferencesIn([readAllContent(rootDir), listTrashedWorks(rootDir)]);
}

function imageReferencesIn(value) {
  const references = new Set();
  const visit = (item) => {
    if (typeof item === 'string' && item.startsWith('images/')) references.add(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return references;
}

function collectVideoReferences(value) {
  const references = new Set();
  const visit = (item) => {
    if (typeof item === 'string' && /^videos\/works\/[a-z0-9-]+\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:mp4|mov|m4v|webm|ogv)$/i.test(item)) references.add(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return references;
}

function listVideoFiles(rootDir, folder = path.join(rootDir, 'public', 'videos', 'works')) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(folder, entry.name);
    if (entry.isDirectory()) return listVideoFiles(rootDir, filePath);
    if (!entry.isFile() || !/\.(?:mp4|mov|m4v|webm|ogv)$/i.test(entry.name)) return [];
    insideRoot(rootDir, filePath);
    return [path.relative(path.join(rootDir, 'public'), filePath).split(path.sep).join('/')];
  });
}

export function pruneOrphanVideos(rootDir) {
  if (contentBatches.has(path.resolve(rootDir))) return;
  const stillUsed = collectVideoReferences([readAllContent(rootDir), listTrashedWorks(rootDir)]);
  for (const videoPath of listVideoFiles(rootDir)) {
    if (stillUsed.has(videoPath) || retainedByHistory(rootDir, videoPath) || pendingMediaContains(rootDir, videoPath)) continue;
    const filePath = path.join(rootDir, 'public', ...videoPath.split('/'));
    insideRoot(rootDir, filePath);
    rmSync(filePath, { force: true });
  }
}

function pruneUnusedImages(rootDir, candidates) {
  if (contentBatches.has(path.resolve(rootDir))) return;
  const stillUsed = collectImageReferences(rootDir);
  for (const imagePath of candidates) {
    if (stillUsed.has(imagePath) || retainedByHistory(rootDir, imagePath) || pendingMediaContains(rootDir, imagePath) || !/^images\/(?:home|about|works\/[a-z0-9-]+)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp|gif)$/i.test(imagePath)) continue;
    const filePath = path.join(rootDir, 'public', ...imagePath.split('/'));
    insideRoot(rootDir, filePath);
    rmSync(filePath, { force: true });
  }
}

export function pruneOrphanImages(rootDir) {
  if (contentBatches.has(path.resolve(rootDir))) return;
  const stillUsed = collectImageReferences(rootDir);
  const groups = ['home', 'about', ...readAllContent(rootDir).categories.map((category) => `works/${category.slug}`)];
  const candidates = groups.flatMap((group) => listImages(rootDir, group));
  pruneUnusedImages(rootDir, candidates.filter((imagePath) => !stillUsed.has(imagePath)));
}

export function saveImage(rootDir, payload) {
  const parsed = parseImageUpload(payload);
  const originalPath = path.parse(parsed.relativePath);
  const folder = path.dirname(parsed.relativePath);
  const absoluteFolder = path.join(rootDir, 'public', ...folder.split('/'));
  insideRoot(rootDir, absoluteFolder);
  mkdirSync(absoluteFolder, { recursive: true });

  // Keep the original when available; otherwise append a number without replacing
  // any existing image. `wx` makes the name reservation safe if uploads race.
  for (let suffix = 1; ; suffix += 1) {
    const filename = suffix === 1
      ? originalPath.base
      : `${originalPath.name}-${suffix}${originalPath.ext}`;
    const relativePath = `${folder}/${filename}`;
    const absolutePath = path.join(absoluteFolder, filename);
    insideRoot(rootDir, absolutePath);
    try {
      writeFileSync(absolutePath, parsed.buffer, { flag: 'wx' });
      try { registerPendingMedia(rootDir, relativePath); }
      catch (error) { rmSync(absolutePath, { force: true }); throw error; }
      return relativePath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

export function parseVideoUpload({ category, filename, mimeType, buffer }) {
  const normalizedCategory = safeSlug(category, 'category');
  const extension = typeof filename === 'string' ? path.extname(path.basename(filename)).toLowerCase() : '';
  if (!ALLOWED_VIDEO_TYPES.get(extension)?.includes(mimeType)) throw new Error('Unsupported video format. Use MP4, MOV, M4V, WebM, or OGV.');
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!content.length || content.length > MAX_VIDEO_BYTES) throw new Error('Video exceeds the 200 MB size limit.');
  const stem = path.basename(filename, path.extname(filename)).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
  return { relativePath: `videos/works/${normalizedCategory}/${stem}${extension}`, buffer: content };
}

export function saveVideo(rootDir, payload) {
  const parsed = parseVideoUpload(payload);
  const folder = path.join(rootDir, 'public', ...path.dirname(parsed.relativePath).split('/'));
  insideRoot(rootDir, folder);
  mkdirSync(folder, { recursive: true });
  const originalPath = path.parse(parsed.relativePath);
  for (let suffix = 1; ; suffix += 1) {
    const filename = suffix === 1 ? originalPath.base : `${originalPath.name}-${suffix}${originalPath.ext}`;
    const absolutePath = path.join(folder, filename);
    insideRoot(rootDir, absolutePath);
    try {
      writeFileSync(absolutePath, parsed.buffer, { flag: 'wx' });
      const relativePath = `${path.dirname(parsed.relativePath)}/${filename}`;
      try { registerPendingMedia(rootDir, relativePath); }
      catch (error) { rmSync(absolutePath, { force: true }); throw error; }
      return relativePath;
    }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
}

export function deleteImage(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !/^images\/(?:home|about|works\/[a-z0-9-]+)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png|webp|gif)$/i.test(relativePath)) {
    throw new Error('Invalid image path.');
  }
  const filePath = path.join(rootDir, 'public', ...relativePath.split('/'));
  insideRoot(rootDir, filePath);
  if (collectImageReferences(rootDir).has(relativePath) || retainedByHistory(rootDir, relativePath) || pendingMediaContains(rootDir, relativePath)) {
    throw new Error('This image is still used by the website or edit history.');
  }
  if (!existsSync(filePath)) throw new Error('Image was not found.');
  rmSync(filePath);
}

const trashIdPattern = /^\d{13}-[0-9a-f-]{36}$/;

function trashFolder(rootDir) {
  return path.join(rootDir, CONTENT_ROOT, 'trash');
}

export function listTrashedWorks(rootDir) {
  const folder = trashFolder(rootDir);
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => name.endsWith('.json') && trashIdPattern.test(name.slice(0, -5)))
    .sort().reverse().map((name) => ({
      id: name.slice(0, -5),
      deletedAt: new Date(Number(name.slice(0, 13))).toISOString(),
      work: readJson(path.join(folder, name)),
    }));
}

export function removeWork(rootDir, categorySlug, workSlug) {
  const filePath = resolveContentFile(rootDir, 'work', [categorySlug, workSlug]);
  if (!existsSync(filePath)) throw new Error('Work was not found.');
  const references = readAllContent(rootDir).categories.flatMap((category) => category.works
    .filter((work) => !(work.category === categorySlug && work.slug === workSlug) && hasWorkLink(work, categorySlug, workSlug))
    .map((work) => `${work.title}（${category.title} / ${work.slug}）`));
  if (references.length) throw new Error(`作品仍被以下内容引用，请先更新链接后再移入回收站：${references.join('、')}`);
  const deletedAt = Date.now();
  const id = `${deletedAt}-${randomUUID()}`;
  const work = readJson(filePath);
  const folder = trashFolder(rootDir);
  mkdirSync(folder, { recursive: true });
  renameSync(filePath, path.join(folder, `${id}.json`));
  return { id, deletedAt: new Date(deletedAt).toISOString(), work };
}

export function restoreWork(rootDir, id) {
  if (!trashIdPattern.test(id)) throw new Error('回收站条目无效。');
  const source = path.join(trashFolder(rootDir), `${id}.json`);
  if (!existsSync(source)) throw new Error('找不到该回收站条目。');
  const work = readJson(source);
  const categories = readJson(resolveContentFile(rootDir, 'categories'));
  if (!categories.some((category) => category.slug === work.category)) throw new Error('原分类已删除。请先重新创建该分类。');
  const target = resolveContentFile(rootDir, 'work', [work.category, work.slug]);
  if (existsSync(target)) throw new Error('原分类中已有相同网址标识的作品。');
  mkdirSync(path.dirname(target), { recursive: true });
  renameSync(source, target);
  return work;
}
