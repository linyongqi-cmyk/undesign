import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isRunnableDevEnvironment } from 'vite';
import { readAllContent, recoverAbandonedContentBatch } from './local-admin/storage.mjs';

function contentPagePaths(projectRoot, relativePath) {
  const route = (path) => `${path}/index.html`;
  const workMatch = relativePath.match(/^src\/data\/content\/works\/([^/]+)\/([^/]+)\.json$/);
  if (workMatch) return [route(`/works/${workMatch[1]}`), route(`/works/${workMatch[1]}/${workMatch[2]}`)];
  if (relativePath === 'src/data/content/about.json') return [route('/about')];
  if (relativePath === 'src/data/content/contact.json') return [route('/contact')];
  if (!['src/data/content/categories.json', 'src/data/content/site.json'].includes(relativePath)) return [];
  const content = readAllContent(projectRoot);
  return [
    '/index.html',
    route('/about'),
    route('/contact'),
    ...content.categories.flatMap((category) => [
      route(`/works/${category.slug}`),
      ...category.works.map((work) => route(`/works/${category.slug}/${work.slug}`)),
    ]),
  ];
}

export function localAdminIntegration(projectRoot) {
  return {
    name: 'local-portfolio-admin',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if (command !== 'dev') return;
        updateConfig({ vite: { plugins: [{
          name: 'local-portfolio-admin-dev-server',
          hotUpdate: {
            order: 'post',
            handler(context) {
              const root = path.resolve(projectRoot);
              const relativePath = path.relative(root, context.file).split(path.sep).join('/');
              if (/^src\/data\/content\/.*\.json$/i.test(relativePath)) {
                if (this.environment.name === 'client') {
                  // Suppressing full reloads protects the manager's draft history, but
                  // server modules and getStaticPaths props still need fresh content.
                  for (const environment of Object.values(context.server.environments)) {
                    if (environment.name === 'client') continue;
                    const graph = environment.moduleGraph;
                    const modules = new Set(graph.getModulesByFile(context.file) || []);
                    const index = graph.getModuleById(path.join(root, 'src/lib/content/index.ts'));
                    if (index) modules.add(index); // Also refresh glob membership on add/delete.
                    const invalidated = new Set();
                    for (const module of modules) graph.invalidateModule(module, invalidated, context.timestamp, true);
                    if (isRunnableDevEnvironment(environment)) {
                      for (const module of invalidated) {
                        const evaluated = module.id && environment.runner.evaluatedModules.getModuleById(module.id);
                        if (evaluated) environment.runner.evaluatedModules.invalidateModule(evaluated);
                      }
                    }
                    environment.hot.send('astro:content-changed', {});
                  }
                  context.server.ws.send({
                    type: 'custom', event: 'portfolio:content-update', data: { paths: contentPagePaths(root, relativePath) },
                  });
                }
                return [];
              }
              return undefined;
            },
          },
          configureServer(server) {
            server.middlewares.use(createLocalAdminMiddleware(path.resolve(projectRoot), server));
          },
        }] } });
      },
    },
  };
}

function localAddress(request) {
  const address = request.socket?.remoteAddress?.replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

function localHost(request) {
  const host = request.headers.host?.toLowerCase();
  return typeof host === 'string' && /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(host);
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== 'string' || !localHost(request)) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && parsed.host.toLowerCase() === request.headers.host.toLowerCase();
  } catch {
    return false;
  }
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body is too large.'));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      if (size > limit) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
  });
}

function readBinaryBody(request, limit, tooLargeMessage = 'Video exceeds the 200 MB size limit.') {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error(tooLargeMessage)); request.resume(); return; }
      chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => { if (size <= limit) resolve(Buffer.concat(chunks)); });
  });
}

function routePath(request) {
  try {
    return new URL(request.url ?? '/', 'http://localhost').pathname.split('/').map((part) => decodeURIComponent(part)).join('/');
  } catch {
    throw new Error('Invalid request path.');
  }
}

function responseError(error) {
  const status = error.status || (/not found/i.test(error.message) ? 404 : /too large|size limit/i.test(error.message) ? 413 : 400);
  return { status, body: { error: error.message, ...(status === 409 ? { conflict: true, record: error.record } : {}) } };
}

export function createLocalAdminMiddleware(projectRoot, viteServer) {
  const root = path.resolve(projectRoot);
  recoverAbandonedContentBatch(root);
  const adminFiles = new Map([
    ['/admin/', ['index.html', 'text/html; charset=utf-8']],
    ['/admin/assets/api.js', ['api.js', 'text/javascript; charset=utf-8']],
    ['/admin/assets/preview.js', ['preview.js', 'text/javascript; charset=utf-8']],
    ['/admin/assets/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ]);

  return async function localAdminMiddleware(request, response, next) {
    let pathname;
    try {
      pathname = routePath(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
    const publicImage = pathname.match(/^\/images\/(?:home|about|works\/[a-z0-9-]+)\/[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i);
    if (request.method === 'GET' && publicImage) {
      const absolutePath = path.resolve(root, 'public', `.${pathname}`);
      const relativePath = path.relative(root, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return sendJson(response, 404, { error: 'Image was not found.' });
      try {
        const contents = await readFile(absolutePath);
        const extension = path.extname(absolutePath).toLowerCase();
        const contentType = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[extension];
        response.writeHead(200, {
          'content-type': contentType,
          'content-length': contents.byteLength,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        return response.end(contents);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
    const isApi = pathname.startsWith('/__local-admin/');
    if (!isAdminPage && !isApi) return next();
    if (!localAddress(request) || !localHost(request)) return sendJson(response, 403, { error: 'Local access only.' });

    if (pathname === '/admin' && request.method === 'GET') {
      response.writeHead(302, { location: '/admin/', 'cache-control': 'no-store' });
      return response.end();
    }
    if (isAdminPage && request.method === 'GET') {
      const file = adminFiles.get(pathname);
      if (!file) return sendJson(response, 404, { error: 'Admin page not found.' });
      let contents = await readFile(path.join(root, 'scripts', 'local-admin', file[0]));
      if (pathname === '/admin/' && viteServer) {
        contents = Buffer.from(await viteServer.transformIndexHtml('/admin/', contents.toString('utf8')));
      }
      response.writeHead(200, {
        'content-type': file[1],
        'content-length': contents.byteLength,
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-src https://www.youtube.com https://player.bilibili.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
      });
      return response.end(contents);
    }

    if (!pathname.startsWith('/__local-admin/api/')) return sendJson(response, 404, { error: 'Local admin endpoint not found.' });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !sameOrigin(request)) return sendJson(response, 403, { error: 'Same-origin request required.' });

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const endpoint = pathname.slice('/__local-admin/api/'.length).split('/');
      if (endpoint[0] === 'batch' && request.method === 'POST') {
        const body = await readJsonBody(request, 8 * 1024 * 1024);
        const storage = await import('./local-admin/storage.mjs');
        if (endpoint.length === 2 && endpoint[1] === 'validate') {
          return sendJson(response, 200, storage.validateContentBatch(root, body?.records, body?.removed, body?.expectedVersions));
        }
        if (endpoint.length === 2 && endpoint[1] === 'begin') return sendJson(response, 200, storage.beginContentBatch(root));
        if (endpoint.length === 2 && endpoint[1] === 'commit') return sendJson(response, 200, storage.commitContentBatch(root, body?.id));
        if (endpoint.length === 2 && endpoint[1] === 'rollback') return sendJson(response, 200, { rolledBack: storage.rollbackContentBatch(root, body?.id) });
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && endpoint[0] !== 'batch' && endpoint.join('/') !== 'history/media') {
        const { assertContentBatchRequest } = await import('./local-admin/storage.mjs');
        assertContentBatchRequest(root, request.headers['x-content-batch']);
      }
      if (request.method === 'POST' && endpoint.join('/') === 'history/media') {
        const { retainHistoryMedia } = await import('./local-admin/storage.mjs');
        const body = await readJsonBody(request, 2 * 1024 * 1024);
        retainHistoryMedia(root, body?.paths);
        return sendJson(response, 200, { retained: true });
      }
      if (request.method === 'GET' && endpoint.length === 1 && endpoint[0] === 'content') {
        const { readAllContent } = await import('./local-admin/storage.mjs');
        return sendJson(response, 200, readAllContent(root));
      }
      if (request.method === 'GET' && endpoint.length === 1 && endpoint[0] === 'images') {
        const { listImages } = await import('./local-admin/storage.mjs');
        return sendJson(response, 200, { images: listImages(root, url.searchParams.get('group')) });
      }
      if (request.method === 'PUT' && endpoint[0] === 'content') {
        const { assertContentRecordVersion, contentRecordVersion, writeContent } = await import('./local-admin/storage.mjs');
        const section = endpoint[1];
        const segments = section === 'work' ? endpoint.slice(2) : [];
        if (!section || (section === 'work' && segments.length !== 2) || (section !== 'work' && endpoint.length !== 2)) return sendJson(response, 400, { error: 'Invalid content path.' });
        const body = await readJsonBody(request, 2 * 1024 * 1024);
        assertContentRecordVersion(root, section, segments, request.headers['if-match']);
        writeContent(root, section, segments, body);
        return sendJson(response, 200, { saved: true, version: contentRecordVersion(root, section, segments) });
      }
      if (request.method === 'POST' && endpoint[0] === 'content' && endpoint[1] === 'rename-work' && endpoint.length === 4) {
        const { assertContentRecordVersion, renameWorkRecord } = await import('./local-admin/storage.mjs');
        const body = await readJsonBody(request, 4096);
        assertContentRecordVersion(root, 'work', [endpoint[2], endpoint[3]], request.headers['if-match']);
        return sendJson(response, 200, { renamed: true, ...renameWorkRecord(root, endpoint[2], endpoint[3], body?.slug, body?.expectedVersions) });
      }
      if (request.method === 'POST' && endpoint[0] === 'content' && endpoint[1] === 'move-work' && endpoint.length === 5) {
        const { assertContentRecordVersion, moveWorkRecord } = await import('./local-admin/storage.mjs');
        assertContentRecordVersion(root, 'work', [endpoint[2], endpoint[4]], request.headers['if-match']);
        const requestBody = request.headers['content-type']?.includes('application/json') ? await readJsonBody(request, 2 * 1024 * 1024) : undefined;
        const work = requestBody?.work ?? requestBody;
        return sendJson(response, 200, { moved: true, ...moveWorkRecord(root, endpoint[2], endpoint[3], endpoint[4], work, requestBody?.expectedVersions) });
      }
      if (request.method === 'DELETE' && endpoint[0] === 'content' && endpoint[1] === 'work' && endpoint.length === 4) {
        const { assertContentRecordVersion, removeWork } = await import('./local-admin/storage.mjs');
        assertContentRecordVersion(root, 'work', [endpoint[2], endpoint[3]], request.headers['if-match']);
        const entry = removeWork(root, endpoint[2], endpoint[3]);
        return sendJson(response, 200, { entry, removed: [`work/${endpoint[2]}/${endpoint[3]}`] });
      }
      if (endpoint[0] === 'trash') {
        const { listTrashedWorks, restoreWork } = await import('./local-admin/storage.mjs');
        if (request.method === 'GET' && endpoint.length === 1) {
          return sendJson(response, 200, { entries: listTrashedWorks(root) });
        }
        if (request.method === 'POST' && endpoint.length === 3 && endpoint[2] === 'restore') {
          const { assertContentRecordVersion, contentRecordVersion } = await import('./local-admin/storage.mjs');
          const trash = listTrashedWorks(root).find((entry) => entry.id === endpoint[1]);
          if (trash) assertContentRecordVersion(root, 'work', [trash.work.category, trash.work.slug], request.headers['if-match']);
          const work = restoreWork(root, endpoint[1]);
          return sendJson(response, 200, { work, version: contentRecordVersion(root, 'work', [work.category, work.slug]) });
        }
      }
      if (request.method === 'POST' && endpoint.length === 1 && endpoint[0] === 'images') {
        const { saveImage, MAX_IMAGE_BYTES } = await import('./local-admin/storage.mjs');
        const contentType = request.headers['content-type'] || '';
        const body = contentType.toLowerCase() === 'image/gif'
          ? { group: url.searchParams.get('group'), filename: url.searchParams.get('filename'), mimeType: contentType, buffer: await readBinaryBody(request, MAX_IMAGE_BYTES, 'Image exceeds the 25 MB size limit.') }
          : await readJsonBody(request, 36 * 1024 * 1024);
        return sendJson(response, 201, { path: saveImage(root, body) });
      }
      if (request.method === 'POST' && endpoint.length === 1 && endpoint[0] === 'videos') {
        const { saveVideo, MAX_VIDEO_BYTES } = await import('./local-admin/storage.mjs');
        const buffer = await readBinaryBody(request, MAX_VIDEO_BYTES);
        const category = url.searchParams.get('category') || '';
        const filename = url.searchParams.get('filename') || '';
        const mimeType = request.headers['content-type'] || '';
        return sendJson(response, 201, { path: saveVideo(root, { category, filename, mimeType, buffer }) });
      }
      if (request.method === 'POST' && endpoint.length === 2 && endpoint[0] === 'images' && endpoint[1] === 'prune') {
        const { pruneOrphanImages } = await import('./local-admin/storage.mjs');
        pruneOrphanImages(root);
        return sendJson(response, 200, { cleaned: true });
      }
      if (request.method === 'DELETE' && endpoint.length === 1 && endpoint[0] === 'images') {
        const { deleteImage } = await import('./local-admin/storage.mjs');
        deleteImage(root, url.searchParams.get('path'));
        return sendJson(response, 200, { deleted: true });
      }
      return sendJson(response, 404, { error: 'Local admin endpoint not found.' });
    } catch (error) {
      const result = responseError(error instanceof Error ? error : new Error('Local admin request failed.'));
      return sendJson(response, result.status, result.body);
    }
  };
}
