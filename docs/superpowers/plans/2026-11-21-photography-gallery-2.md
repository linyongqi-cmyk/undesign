# 摄影图集2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的 `photographyGallery2` 左文右图模板，保留旧模板及作品字段，并保证前台和管理画布一致。

**Architecture:** 延用 `gallery`、`sections`、`leftSections` 和现有媒体字段，只增加模板值与新布局变体。前台与管理画布各自复用同一套摄影图库布局计算，放大仍调用共享查看器；服务端校验、Puck 转换和模板选择同步识别新值。

**Tech Stack:** Astro、React/Puck、TypeScript/JavaScript、CSS。

**Spec:** `摄影图集2-设计与执行说明.md`

## Global Constraints

- 旧摄影图集与图文分栏布局、内容、默认行为保持不变。
- 右侧图片栏宽 `53vw` 并贴齐屏幕右侧 `2vw` 留白边界，文字栏从原左边缘弹性扩展，列距 `48px`，图片最终可见视口不超过 `90vh`；空间不足时收缩或单列。
- 图库继续以 `gallery` 为唯一图片源，顺序单列；摄影说明、链接、裁切和缩放字段不得丢失。
- 摄影点击放大缺省关闭，仅两种摄影模板支持；管理画布点击图片仍用于编辑。
- 修改后运行 `npm run build` 并对照相同作品检查前台和画布；不额外添加或运行测试。
- 完成时更新 `交接.md`、`修改记录.md`；不发布、不推送。

## Review Focus

- splitDetail 往返切换、旧 `leftSections` 与图库迁移不得重复或漏内容；在本地画布切换、撤回并重载检查。
- 图片原始/裁切比例、缺失元数据及极端竖图仍需限高且不变形；在多视口测量最终框。
- 新模板的放大按钮、图角链接和编辑点击不得互相遮挡；分别检查前台、画布与键盘焦点。
- 管理画布缩放与前台 viewport 宽度不同可能影响 vw；通过实际布局测量确认两端宽度规则。
- `photographyIntroWidth` 只对旧摄影图集生效；新模板保留历史值，但不显示无效的 UP/vw 编辑入口。
- 运行中的服务可能缓存本地 API 校验模块；若改 storage 模块，重启服务后通过实际 API 保存并重读。

---

### Task 1: 模板值与内容转换

**Files:**
- Modify: `src/lib/content/types.ts`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/storage.mjs`
- Modify: `src/pages/works/[category]/[slug].astro`

- [x] 增加 `photographyGallery2` 类型、管理选项、前台白名单与服务端校验。
- [x] 摄影图集与摄影图集2切换只改模板值并保留图库、说明、裁切、链接、放大开关和正文；临时保存后 JSON 仅 template 字段不同。
- [ ] 图文分栏切入时按既有字段契约导出；无法放入图库的左/右区内容安全保留到正文区，避免重复图库。
- [ ] 验收切换、撤回/重做、保存/重载；如修改 `storage.mjs`，重启 Astro 并通过运行 API 核对保存与读取。

### Task 2: 前台新模板与限高布局

**Files:**
- Modify: `src/pages/works/[category]/[slug].astro`
- Modify: `src/styles/global.css`
- Reuse: `src/lib/content/photography-gallery-layout.js`

- [x] 新增显式左文右图分支，正文取 `workBodySections(work)`，图库按数组顺序单列。
- [x] 模板私有尺寸规则实现约 53vw 媒体目标、弹性文字栏、空间不足收缩及手机先文后图。
- [x] 限制最终裁切视口高度 `90vh`，按实际比例缩放，保持 caption 和链接在图片框外/角落的既有语义。
- [x] 回归旧摄影桌面布局；文章与图文分栏浏览器回归未验证。

### Task 3: 管理画布共用布局与摄影交互

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/styles.css`
- Modify: `src/pages/works/[category]/[slug].astro`

- [x] 让管理画布显示左文右图及同序单列图库，编辑辅助控件不参与内容尺寸。
- [x] 新模板复用放大查看器；只在启用开关时提供前台入口。图角链接优先级未验证。
- [x] 同一已保存作品桌面下对照前台和画布内容、顺序与栏宽；所有裁切情形未逐一验证。

### Task 4: 完成检查与记录

**Files:**
- Modify: `交接.md`
- Modify: `修改记录.md`

- [x] 运行 `npm run build`，记录实际生成页数和结果。
- [ ] 检查桌面、平板、手机纵横屏，记录栏宽、图片高度和横向溢出；未检查项如实写未验证。
- [x] 将前端与管理端分别升至适用版本，重写交接最近五轮并置顶一条本任务修改记录。
- [x] 明确本地修改、未发布/推送及剩余待办。
