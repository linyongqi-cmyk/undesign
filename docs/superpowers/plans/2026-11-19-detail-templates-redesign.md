# 作品详情模板重做实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留图文分栏，并新增文章阅读、摄影图集两种真正不同的详情排版。

**Architecture:** 统一作品模板类型与 JSON 赋值；前台 Astro 页面和 Puck 编辑画布使用同一套模板布局规则；模板切换在保留图库、内容区块与嵌套数据的基础上转换分栏与纵向结构。

**Tech Stack:** Astro、React、TypeScript、CSS、JSON。

**Spec:** `docs/superpowers/specs/2026-11-19-detail-templates-design.md`

## Global Constraints

- 详情模板只有 `splitDetail`、`articleReading`、`photographyGallery` 三种。
- 文章阅读版：标题、日期、主图、正文顺序，窄幅单栏。
- 摄影图集版：标题、简介、元信息在上，两列瀑布流，窄屏单列。
- 作品媒体和文字来源继续以 `src/data/content/works/` 为准。
- 管理预览与前台保持一致；图文分栏切换不得丢失内容。
- 不推送、不发布、不新增测试。

## Review Focus

- 不同模板之间转换时图库和 `root:left` / `root:right` 内容是否完整保留。
- 单年摄影目前只有封面和简介，模板不可凭空产生参考页面的其它照片。
- 摄影图集用主图/图库/区块媒体时不可重复显示图片，图片说明必须跟随所属图片。
- Research Log 不使用详情模板，清理旧字段不能影响日志页。
- 手机布局应为单列，桌面分栏宽度不应挤压内容。

---

### Task 1: 模板类型、旧数据迁移和创建默认值

**Files:**
- Modify: `src/lib/content/types.ts`
- Modify: `src/data/content/works/visual/undesign.json`
- Modify: `src/data/content/works/photography/*.json`
- Modify: `src/data/content/works/research/*.json`
- Modify: `src/components/admin/PuckWorkEditor.jsx`

- [ ] 将 `Template` 类型限定为三种新模板值，并允许研究作品省略模板字段。
- [ ] 把 `visual/undesign` 设为 `articleReading`，Photography 三篇现有作品设为 `photographyGallery`；其余现有 splitDetail 作品维持原值，Research 删除无效旧 template 字段。
- [ ] 将新建 Photography 的默认模板改为 `photographyGallery`，其他分类沿用现行 `splitDetail` 默认；下拉菜单显示且仅显示三种模板。
- [ ] 明确旧/未知纵向模板值渲染为 `articleReading` 的兼容回退；分栏值不改变。

### Task 2: 前台详情页和 Puck 画布模板结构

**Files:**
- Modify: `src/pages/works/[category]/[slug].astro`
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/styles/global.css`

- [ ] 前台实现文章阅读和摄影图集两种布局：正文区块顺序保持，摄影媒体及说明按两列瀑布流排布；手机回落单列。
- [ ] Puck 画布实现同样的 DOM 结构和样式，并把日期、图库及详情媒体用作预览数据。
- [ ] 修正模板切换转换：分栏转纵向时保留已有 gallery 字段、主图及两区区块；纵向转分栏时沿用当前媒体进左区、文字进右区逻辑。
- [ ] 避免照片出现在 gallery 和内容区块时重复渲染；图片说明与照片共同分页/列流。
- [ ] 移除旧模板样式分支，只保留三个模板需要的 CSS。

### Task 3: 构建与本地页面核对

**Files:** 无新增文件。

- [ ] 运行 `npm run build`，如失败先修复。
- [ ] 启动本地开发服务，核对 Undesign 文章阅读页、Photography 图集页、现有 Product 图文分栏页。
- [ ] 检查桌面和手机宽度，重点确认摄影图片列流、文章宽度、图文分栏手机顺序与 Puck 编辑器预览。
