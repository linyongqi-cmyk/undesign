# 作品详情图片轮播实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在作品详情的添加内容中提供可管理的多图轮播组件，访客侧自动播放并可手动切换。

**Architecture:** 新增独立的 `ImageCarouselBlock` Puck 组件并映射到 `imageCarousel` 内容数据。管理画布用手动预览编辑幻灯片，访客页面用独立脚本维护每个轮播实例；两端共用图片结构和首页轮播间隔设置。

**Tech Stack:** Astro、React、Puck、TypeScript、静态 JSON 内容数据。

**Spec:** `docs/superpowers/specs/2026-11-14-work-image-carousel-design.md`

## Global Constraints

- 不改变现有“图片”“图片组合”、作品主图库或首页封面的数据与行为。
- 管理画布只由箭头切换当前预览；访客页面使用首页轮播间隔并在手动切换后重新计时。
- 每张图片保存独立的 `src`、`alt`、裁切比例、位置和缩放；预览索引不持久化。
- 保持作品页极简视觉和响应式行为；不引入轮播依赖。
- 遵守项目规则：执行 `npm run build` 并检查本地管理页与作品页；不添加或运行测试。

## Review Focus

- 图片数量为 0 或 1 时应隐藏无效轮播控件：由 Task 2/3 的本地页面检查确认。
- 删除或排序当前幻灯片后索引应仍有效：由 Task 1 的交互代码自检并在管理页面操作确认。
- 同一页面有多个轮播时状态和计时器不能串扰：由 Task 2 的页面检查确认。
- 自动切换和连续快速手动切换可能竞争：由 Task 2 的切换实现检查确认每次手动操作仅重置当前实例计时器。
- 已有内容组件必须保持原样：由 Task 1 的数据映射检查及 Task 3 的构建验证确认。

---

### Task 1: 接入轮播内容模型与管理组件

**Files:**
- Modify: `src/lib/content/types.ts`
- Modify: `src/lib/admin/puck-work-document.js`
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `scripts/local-admin/styles.css`

**Interfaces:**
- Consumes: existing `PuckImageEditor`, `updateBlockProps`, `onGalleryUpload`, and `workToPuckDocument` interfaces.
- Produces: `ContentBlock` variant `{ kind: 'imageCarousel'; images: ContentImage[] }` and Puck type `ImageCarouselBlock` with `images` props.

- [ ] **Step 1: Extend round-trip conversion**
  - Add `imageCarousel` ↔ `ImageCarouselBlock` mapping; preserve all image crop fields and array order.
  - Keep old `ImageBlock`/`ImagePairBlock` conversions unchanged.
- [ ] **Step 2: Add management editor and drawer icon**
  - Add `ImageCarouselBlock` to “添加内容” with one consistent line icon.
  - Implement a canvas editor showing one selected slide, manual previous/next, `NN / NN`, add images (multi-file upload), replace, crop, remove, and reorder current slide.
  - Keep preview index local to the editor and safe after add/remove/reorder.
  - Add default crop values and empty state; delegate upload to existing `onGalleryUpload`.
- [ ] **Step 3: Add concise responsive styling**
  - Match existing canvas image action toolbar and drawer icon style; avoid thumbnail strip and overlays on the photograph.

### Task 2: Render and run public detail carousels

**Files:**
- Modify: `src/components/content/ContentBlock.astro`
- Modify: `src/pages/works/[category]/[slug].astro`
- Create: `src/scripts/content-image-carousel.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `imageCarousel` content block and site `rotationSeconds` from `getSiteSettings()`.
- Produces: scoped `[data-image-carousel]` DOM instances with slide images, accessible previous/next buttons, and count text.

- [ ] **Step 1: Render initial state and controls**
  - Render only non-empty images, first valid slide visible, `01 / NN` count, arrows only when at least two valid slides exist.
  - Forward site rotation seconds to each instance through a data attribute.
- [ ] **Step 2: Implement instance-scoped rotation**
  - Use a single timeout per instance, matching home fade and wraparound behavior.
  - On either arrow click, show exactly one target slide then schedule from now; clean up timers/listeners on page lifecycle changes.
  - Multiple blocks on a page must initialize and advance independently.
- [ ] **Step 3: Style accessible, responsive controls**
  - Keep arrows and count unobtrusive; maintain visible keyboard focus and thumb-friendly controls on narrow screens.

### Task 3: Build and inspect the integrated flow

**Files:**
- Verify: local admin at `http://localhost:4321/admin/`
- Verify: work detail page containing the newly added carousel

- [ ] Add a carousel in the local admin, upload multiple images, test manual preview, reorder, crop, delete, then save.
- [ ] Confirm the generated local content reloads with the same images/order/crop and the front-end cycles automatically and manually.
- [ ] Inspect a narrow viewport for toolbar and arrow overlap.
- [ ] Run `npm run build` and address any failures.
