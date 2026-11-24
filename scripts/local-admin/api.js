const API = '/__local-admin/api';
let recordVersions = {};
let contentBatchId = '';
let batchVersionsSnapshot = null;

function contentKey(section, segments = []) { return section === 'work' ? `work/${segments[0]}/${segments[1]}` : section; }
function expectedVersion(section, segments = []) { return recordVersions[contentKey(section, segments)] ?? 'missing'; }
function acceptVersions(data) {
  for (const key of data.removed || []) delete recordVersions[key];
  Object.assign(recordVersions, data.versions || {});
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    cache: 'no-store',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(contentBatchId ? { 'x-content-batch': contentBatchId } : {}), ...options.headers },
  });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
  return data;
}

export const retainHistoryMedia = (paths) => request('/history/media', { method: 'POST', body: JSON.stringify({ paths }) });

export const loadContent = async () => {
  const content = await request('/content');
  recordVersions = content.versions || {};
  return content;
};
export const listImages = (group) => request(`/images?group=${encodeURIComponent(group)}`);
export const saveRecord = async (section, value, segments = []) => {
  const path = ['/content', section, ...segments].map(encodeURIComponent).join('/');
  const data = await request(path, { method: 'PUT', body: JSON.stringify(value), headers: { 'if-match': expectedVersion(section, segments) } });
  recordVersions[contentKey(section, segments)] = data.version;
  return data;
};
export const validateBatch = (records, removed) => {
  const expectedVersions = {};
  for (const { section, segments = [] } of records) {
    const key = contentKey(section, segments);
    expectedVersions[key] = expectedVersion(section, segments);
  }
  for (const key of removed) expectedVersions[key] = recordVersions[key] ?? 'missing';
  return request('/batch/validate', { method: 'POST', body: JSON.stringify({ records, removed, expectedVersions }) });
};
export const beginBatch = async () => {
  const result = await request('/batch/begin', { method: 'POST', body: '{}' });
  contentBatchId = result.id;
  batchVersionsSnapshot = { ...recordVersions };
  return result;
};
export const commitBatch = async () => {
  if (!contentBatchId) throw new Error('保存事务未开始。');
  const result = await request('/batch/commit', { method: 'POST', body: JSON.stringify({ id: contentBatchId }) });
  contentBatchId = '';
  batchVersionsSnapshot = null;
  return result;
};
export const rollbackBatch = async () => {
  if (!contentBatchId) return false;
  const result = await request('/batch/rollback', { method: 'POST', body: JSON.stringify({ id: contentBatchId }) });
  contentBatchId = '';
  if (batchVersionsSnapshot) recordVersions = batchVersionsSnapshot;
  batchVersionsSnapshot = null;
  return result.rolledBack;
};
export const removeWork = (category, slug) => request(`/content/work/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`, { method: 'DELETE', headers: { 'if-match': expectedVersion('work', [category, slug]) } }).then((data) => { acceptVersions(data); return data; });
export const loadTrash = () => request('/trash');
export const restoreWork = (id) => request(`/trash/${encodeURIComponent(id)}/restore`, { method: 'POST' }).then((data) => {
  const work = data.work;
  if (work) recordVersions[contentKey('work', [work.category, work.slug])] = data.version;
  return data;
});
export const renameWork = (category, previousSlug, slug) => request(`/content/rename-work/${encodeURIComponent(category)}/${encodeURIComponent(previousSlug)}`, { method: 'POST', body: JSON.stringify({ slug, expectedVersions: recordVersions }), headers: { 'if-match': expectedVersion('work', [category, previousSlug]) } }).then((data) => { acceptVersions(data); return data; });
export const transferWork = (fromCategory, toCategory, slug, work) => request(`/content/move-work/${encodeURIComponent(fromCategory)}/${encodeURIComponent(toCategory)}/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'if-match': expectedVersion('work', [fromCategory, slug]) }, ...(work ? { body: JSON.stringify({ work, expectedVersions: recordVersions }) } : {}) }).then((data) => { acceptVersions(data); return data; });

export const pruneOrphanImages = () => request('/images/prune', { method: 'POST' });

async function compressForUpload(file) {
  // Canvas only preserves a GIF's first frame, so keep the original animated file.
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
  if (isGif) {
    const filename = /\.gif$/i.test(file.name || '') ? file.name : `${file.name || 'image'}.gif`;
    return file.type === 'image/gif' && filename === file.name
      ? file
      : new File([file], filename, { type: 'image/gif', lastModified: file.lastModified || Date.now() });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片。');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理这张图片，请换一张图片重试。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('图片压缩失败，请重试。')), 'image/webp', 0.86);
    });
    const filename = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`;
    return new File([blob], filename, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('图片读取失败，请重试。'));
      else resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, group) {
  const optimizedFile = await compressForUpload(file);
  if (optimizedFile.type === 'image/gif') {
    const params = new URLSearchParams({ group, filename: optimizedFile.name });
    const response = await fetch(`${API}/images?${params}`, {
      method: 'POST',
      body: optimizedFile,
      headers: { 'content-type': 'image/gif' },
      cache: 'no-store',
    });
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
    if (!response.ok) throw new Error(data.error || `图片上传失败 (${response.status})`);
    return data;
  }
  return request('/images', {
    method: 'POST',
    body: JSON.stringify({ group, filename: optimizedFile.name, mimeType: optimizedFile.type, data: await fileAsBase64(optimizedFile) }),
  });
}

export async function uploadVideo(file, category) {
  const params = new URLSearchParams({ category, filename: file.name });
  const response = await fetch(`${API}/videos?${params}`, { method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' }, cache: 'no-store' });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.error || `视频上传失败 (${response.status})`);
  return data;
}
