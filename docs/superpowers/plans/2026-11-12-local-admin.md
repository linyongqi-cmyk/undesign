# 本地作品集管理界面实施计划

> **执行提示：** 实施时按此计划逐项完成；每项结束后检查对应结果。此工作由当前会话中的实现者顺序执行，暂不拆分并行任务。

**目标：** 用一个只在本机开发时可用的 `/admin/` 新标签页面取代 Sanity 后台，将作品集所有可编辑内容保存到项目 JSON 文件和图片目录。

**架构：** Astro 公开页面在构建期读取拆分后的本地 JSON，继续生成静态网站。Astro 开发服务器通过本地中间件提供 `/admin/` 界面及受限文件读写 API；中间件在 build/preview 中不注册，管理入口只在开发页面显示。管理页编辑草稿并按现有详情模板预览，确认后保存到本机文件。

**技术栈：** 现有 Astro 7、TypeScript、HTML/CSS/浏览器 JavaScript、Node.js 开发服务、JSON；尽量不增加运行时依赖。

**设计稿：** `docs/superpowers/specs/2026-11-12-local-admin-design.md`

## 全局约束

- 图片继续位于 `public/images/home/`、`public/images/about/` 和 `public/images/works/<category>/`。
- 本地写入接口只绑定回环地址（`127.0.0.1`），并检查 Host / Origin；不支持局域网其他设备编辑。
- 开发管理页与写入 API 不出现在构建后的公开网站中。
- 保留极简视觉、响应式布局和已确认的页面结构。
- 不添加第三方测试框架或宽泛测试套件；用 Node 内置测试覆盖内容迁移与本地写入安全边界，另按项目要求运行 `npm run build` 并检查本地页面与编辑流程。
- 不推送 GitHub、不部署、不删除 Sanity 云端项目、不添加付费服务。

## 主要风险检查点

- 内容文件为空或损坏：管理 API 拒绝无效内容并保留上一份有效文件。归属任务 2，手工提交无效 JSON 验证拒绝并确认文件未被覆盖。
- 路径穿越或非法 slug：所有写入路径由服务器端白名单映射，不接受客户端任意文件路径。归属任务 2，手工请求恶意路径并确认 API 拒绝。
- 上传伪造类型、超大文件或不支持扩展名：按允许格式和体积限制拒绝，并返回可读错误。归属任务 2，手工上传不支持格式确认被拒绝。
- 首页背景列表为空或含不存在图片：保存前验证并要求至少一张有效背景。归属任务 2，手工清空最后一张图片确认不可保存。
- 构建中误包含管理页或文件写入接口：生产构建必须无 `/admin/` 界面与管理 API。归属任务 4/5，构建后检查 `dist/` 且只上传该目录。

---

### 任务 1：建立本地内容文件并切换公开页面读取

**文件：**

- 新建：`src/data/content/site.json`
- 新建：`src/data/content/about.json`
- 新建：`src/data/content/contact.json`
- 新建：`src/data/content/categories.json`
- 新建：`src/data/content/works/<category>/<slug>.json`
- 新建：`src/lib/content/types.ts`
- 新建：`src/lib/content/index.ts`
- 修改：`src/data/portfolio.ts`（仅迁出内容后删除）
- 修改：`src/pages/index.astro`
- 修改：`src/pages/about.astro`
- 修改：`src/pages/contact.astro`
- 修改：`src/pages/works/[category].astro`
- 修改：`src/pages/works/[category]/[slug].astro`
- 修改：`src/layouts/SiteLayout.astro`
- 修改：`src/components/content/ContentBlock.astro`

**接口：**

- `getSiteSettings(): SiteSettings`
- `getAboutProfile(): AboutProfile`
- `getContactSettings(): ContactSettings`
- `getCategories(): Category[]`
- `getCategoryBySlug(slug: string): Category | undefined`
- `getWork(categorySlug: string, workSlug: string): Work | undefined`
- JSON 内容成为唯一本地可编辑来源；页面移除 CMS fetch 与 image asset 归一化逻辑。

- [x] 把现有全站、About、Contact、分类、作品和详情页区块资料一次性迁入 JSON，保持文字、排序、模板和本地图片路径不变。
- [x] 实现 `src/lib/content/` 类型及读取接口，使用本地 JSON 在构建期解析所有静态作品路由。
- [x] 改造页面、共享导航及详情区块渲染器，让它们只读取本地内容接口，并使用普通本地图片路径。
- [x] `node --test scripts/local-content.test.mjs` 验证 JSON 保留现有首页轮播、About/Contact、分类顺序及「樓」作品图片和模板。
- [x] 运行 `npm run build`，确认分类和详情页数量与迁移前一致，首页、分类、About、Contact 均能从 JSON 构建。

### 任务 2：提供只在开发模式注册的本地管理 API

**文件：**

- 新建：`scripts/local-admin-integration.mjs`
- 新建：`scripts/local-admin/storage.mjs`
- 修改：`astro.config.mjs`
- 修改：`package.json`（增加本地开发启动命令别名，如需要）

**接口：**

- `localAdminIntegration(projectRoot)`：只在 `astro:server:setup` 注册开发服务中间件。
- `GET /__local-admin/api/content`：返回 site、about、contact、categories 与作品 JSON。
- `PUT /__local-admin/api/content/:section`：只按允许的 section/slug 写入已知内容文件，先校验再原子替换。
- `POST /__local-admin/api/images`：接收 `file` 与 `group`，写入允许的 home/about/category 图片目录，返回本地相对路径。
- `DELETE /__local-admin/api/images`：仅删除允许目录下且未被内容引用的图片。
- `GET /admin/` 与 `/admin/assets/*`：由开发中间件提供独立管理页静态文件。
- `node --test scripts/local-admin-storage.test.mjs`：覆盖固定路径映射、路径穿越拒绝、图片格式/大小边界。

- [x] 在 Astro 配置中仅于 `command === 'dev'` 安装本地管理中间件；绑定回环地址，校验 Host / Origin，并限制请求体、文件格式、文件大小、字段及目标路径。
- [x] 实现内容读写、原子文件替换和图片上传/删除接口；任何验证失败都返回明确错误且不修改原文件。
- [x] 用内置测试验证本地 JSON 写入、无效内容及路径拒绝、图片类型/大小限制和错误不覆盖现有文件。
- [x] 确认构建时不注册这些中间件和接口。

### 任务 3：实现独立管理页面与保存前预览

**文件：**

- 新建：`scripts/local-admin/index.html`
- 新建：`scripts/local-admin/app.js`
- 新建：`scripts/local-admin/styles.css`
- 修改：`src/layouts/SiteLayout.astro`
- 修改：`src/styles/global.css`（仅在预览复用公开页面样式需要时）

**接口：**

- 管理页面从任务 2 的 API 读取并保存 `site`、`about`、`contact`、`categories`、`works`。
- 管理页预览使用与公开页相同的模板类型与内容区块规则；图片上传结果使用 API 返回的相对路径。

- [x] 添加只在 `import.meta.env.DEV` 时渲染的“管理”入口；入口在新标签打开 `/admin/`。
- [x] 实现管理页导航与表单：网站标题/描述、首页背景列表及轮换时间、背景缩放/位置、About、Contact、分类和作品资料。
- [x] 实现作品编辑：预设模板 `standard` / `galleryLed` / `researchEssay`；详情区块 `richText` / `imageWithCaption` / `gallery` / `imageText` / `quote` / `link` 可新增、移除、调整顺序和编辑内容。
- [x] 实现作品分类与排序、作品图片上传/替换/移除。不能保存无背景首页或不存在的图片路径。
- [x] 在管理页内提供保存前预览；用浏览器修改并恢复作品标题，确认 JSON 写入与预览更新。
- [x] 检查桌面管理页、首页背景缩放/位置预览和区块排序；确认本地入口新标签跳转。窄屏断点已定义，未通过浏览器单独调小视窗检查。

### 任务 4：移除 Sanity / Worker 预览集成并更新部署配置

**文件：**

- 删除：`studio/`
- 删除：`src/lib/cms/`
- 删除：`src/pages/api/draft-mode/`
- 删除：`src/pages/preview/`
- 删除：`scripts/migrate-sanity-content.ts`
- 删除：`wrangler.jsonc`
- 修改：`astro.config.mjs`（使用 Astro 静态输出，移除 Cloudflare adapter）
- 修改：`package.json` 与 `package-lock.json`
- 修改：`.github/workflows/deploy.yml`
- 修改：`.env.example` / `.dev.vars.example`（移除 Sanity 配置示例）
- 删除或改写：`docs/cms-setup.md`
- 修改：`README.md`、`WORKFLOW.md`、CMS 实施 ledger
- 保留本机已有的根 `.env` 与 `studio/.env`；它们不再被新流程读取，Sanity 云项目也保持闲置。

- [x] 移除 Sanity、Cloudflare Worker 与 Wrangler 依赖及 API/草稿预览代码；详情页保留项目内的本地 PortableText 段落渲染器，不依赖第三方 CMS 包。
- [x] 将 Astro 输出改回静态站点，并从 GitHub Pages 工作流移除 Sanity 环境变量；工作流仅上传 `dist/`。
- [x] 把 CMS 初始化说明改成本地管理页启动、编辑、预览与发布说明；记录云端 Sanity 项目未触碰。
- [x] 再次运行 `npm run build`，无 CMS 配置完成 28 个静态页面构建。

### 任务 5：本地端到端检查与交付说明

**检查范围：**

- `http://localhost:4321/` 首页入口、本地管理页、首页背景保存、作品字段/排序/区块编辑、图片保存和作品详情预览。
- `dist/` 生产静态产物中不存在 `/admin/`、`/__local-admin/` 文件写入接口或仅管理页资源。
- 桌面与窄屏公开页、导航入口仅本机开发可见、现有公开图片路径和页面可用。

- [x] 使用本地浏览器打开管理页，编辑并还原作品标题，验证 JSON 写入、预览与原始值恢复。
- [x] 检查首页封面缩放/位置预览、区块排序和详情预览；重建确认内容还原后仍可构建。
- [x] 确认当前代码不读取 `.env` 文件，部署 workflow 无 CMS 密钥引用；没有推送或发布。
- [x] 更新 README 与工作流程为本地编辑说明；管理地址为 `http://localhost:4321/admin/`。
