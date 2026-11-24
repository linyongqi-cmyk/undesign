import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkContent } from './local-admin/storage.mjs';

const projectRoot = path.resolve(process.argv[2] || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worksRoot = path.join(projectRoot, 'src', 'data', 'content', 'works');
const errors = [];

function listJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listJsonFiles(entryPath) : entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
    });
}

const files = listJsonFiles(worksRoot);
if (!files.length) errors.push(`${path.relative(projectRoot, worksRoot)}: 没有找到作品 JSON 文件。`);

for (const filePath of files) {
  const relativePath = path.relative(worksRoot, filePath).split(path.sep);
  const displayPath = path.relative(projectRoot, filePath);
  if (relativePath.length !== 2) {
    errors.push(`${displayPath}: 文件必须位于 works/<分类>/<作品>.json。`);
    continue;
  }
  const [categorySlug, filename] = relativePath;
  const workSlug = filename.slice(0, -'.json'.length);
  let record;
  try {
    record = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${displayPath}: JSON 语法错误：${error.message}`);
    continue;
  }

  try {
    validateWorkContent(projectRoot, categorySlug, workSlug, record);
  } catch (error) {
    errors.push(`${displayPath}: ${error.message}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`错误：${error}`);
  console.error(`作品内容校验失败：${errors.length} 个问题，检查了 ${files.length} 个文件。`);
  process.exitCode = 1;
} else {
  console.log(`作品内容校验通过：${files.length} 个文件。`);
}
