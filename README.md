# LIN YONGQI portfolio

An Astro-powered static portfolio based on the Studio preview. The site includes the shared responsive navigation, home cover, five work sections, project detail routes, a bilingual About page, contact links, and locally stored preview images.

## Run locally

```sh
npm install
npm run dev
```

Astro prints the local preview address in the terminal (usually `http://localhost:4321/`).

## Build static files

```sh
npm run build
```

The public static website is written to `dist/`.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes `dist/` on pushes to `main`. It sets the correct project path from the repository name. For a user site named `<account>.github.io`, it uses the root path.

Portfolio text and project listings are in the JSON files under `src/data/content/`; page templates are in `src/pages/`; images are grouped by purpose and work category under `public/images/`.

For agreed UI terms, see [UI terms](docs/ui-terms.md); for archived editor and interaction specs, see [feature specs](docs/feature-specs.md).

## Content editing

While the local preview is running, use the “管理内容” link in the sidebar or open [http://localhost:4321/admin/](http://localhost:4321/admin/) in a new tab. The editor saves text and structure to `src/data/content/` and uploaded images to the categorized folders under `public/images/`. Management is available only through the local development server; build with `npm run build` before publishing.

## 项目目录与清理边界

- `src/data/content/` 是当前实际内容源，`src/lib/content/index.ts` 负责前台读取；旧路径 `src/data/portfolio.ts` 已不存在。
- `scripts/local-admin/` 与 `src/components/admin/` 是本机管理端；`src/components/content/` 与 `src/lib/content/` 提供共享渲染和布局规则。
- `backups/` 是人工回退快照，不参与构建；`docs/superpowers/` 和 `.superpowers/` 是历史设计与实施记录，不能当作当前功能说明。
- `临时图片库/` 是原始素材，`src/data/content/trash/` 是管理回收站，均不按“无前台引用”直接删除。已上传媒体还可能被管理标签页的草稿和撤回历史引用。
- `dist/`、`.astro/`、`node_modules/` 是可再生输出或依赖；`.wrangler/` 属于旧部署缓存且已忽略。GitHub Pages 是现行部署流程。
- `.env`、`studio/.env` 为历史本机配置，现行管理流程不读取；保留本机文件，不输出其内容。
