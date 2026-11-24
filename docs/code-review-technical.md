# 代码审查报告（技术专业版）

> 检查时间：2026-11-24  
> 项目类型：Astro 静态作品集网站  
> 构建状态：✅ `npm run build` 成功通过（28 个静态路由，构建耗时约 2.2s，无构建警告/错误，静态媒体资源引用完整）

---

## 一、 Bug 与潜在运行时异常（4 项）

### 1. `[slug].astro` 内嵌相册脚本存在空指针异常隐患（高优先级）
* **定位文件：** `src/pages/works/[category]/[slug].astro`（约 166–184 行）
* **问题描述：**
  在作品详情页内嵌客户端脚本中：
  ```javascript
  const root = document.querySelector('[data-gallery]');
  const image = root?.querySelector('img');
  const counter = root?.querySelector('.gallery-counter');
  let index = 0;
  const show = (next) => {
    // ...
    image.src = ...; // 若 image 为 null 则抛出 TypeError
    // ...
    counter.textContent = ...; // 若 counter 为 null 则抛出 TypeError
  };
  ```
  尽管该 `<script>` 仅在 `gallery.length > 1` 时生成，但如果 DOM 结构因模板变更未包含 `img` 或 `.gallery-counter`，调用 `show()` 时将直接抛出未捕获的 `TypeError: Cannot set properties of null`，导致控制台报错且后续逻辑中断。
* **修复建议：**
  在操作前增加防御性判断：`if (!image || !counter) return;`。

---

### 2. `Work` 类型定义缺失 `leftSections` 属性
* **定位文件：** 
  * `src/lib/content/types.ts`（`Work` 类型定义）
  * `src/pages/works/[category]/[slug].astro`（第 35、66 行）
* **问题描述：**
  在 `[slug].astro` 中读取了 `work.leftSections`：
  ```astro
  const bodySections = template === 'photographyGallery2'
    ? workBodySections({ ...work, sections: [...(work.leftSections || []), ...(work.sections || [])] })
    : allBodySections;
  ...
  {work.leftSections?.map((block) => <ContentBlock block={block} rotationSeconds={rotationSeconds} />)}
  ```
  但在 `types.ts` 的 `Work` 接口声明中并未包含 `leftSections?: ContentBlock[];`。目前仅靠可选链 `?.` 与逻辑或 `|| []` 在运行时避免报错，但违背了 TypeScript 静态类型一致性。
* **修复建议：**
  在 `src/lib/content/types.ts` 的 `Work` 类型中显式声明：
  ```typescript
  export type Work = {
    // ...
    leftSections?: ContentBlock[];
    // ...
  };
  ```

---

### 3. `ContentBlock` 联合类型缺失 `subheading` 分支定义
* **定位文件：**
  * `src/lib/content/types.ts`（`ContentBlock` 类型定义）
  * `src/components/content/ContentBlock.astro`（第 87 行）
  * `src/data/content/works/research/2205-fractal.json`（已在生产数据中使用）
* **问题描述：**
  渲染组件 `ContentBlock.astro` 已经实现了 `subheading` 的分支渲染：
  ```astro
  {block.kind === 'subheading' && <h2 class="detail-subheading text-style-subheading" style={textStyle('subheading')}>{block.text}</h2>}
  ```
  且在 `2205-fractal.json` 中存在多处 `"kind": "subheading"` 的内容块。但在 `types.ts` 的 `ContentBlock` 类型定义中却遗漏了该分支，导致类型系统与实际数据/渲染逻辑脱节。
* **修复建议：**
  在 `ContentBlock` 联合类型中补充分支：
  ```typescript
  | { kind: 'subheading'; text: string }
  ```

---

### 4. 同步数据函数与异步调用混用问题
* **定位文件：**
  * `src/lib/content/index.ts`（`getCategories`、`getSiteSettings` 定义）
  * `src/layouts/SiteLayout.astro`（第 20–23 行）
  * `src/components/content/ContentBlock.astro`（第 27、39 行）
  * `src/pages/works/[category]/[slug].astro`（第 24 行）
* **问题描述：**
  `getCategories()` 与 `getSiteSettings()` 在 `index.ts` 中完全是同步读取内存 JSON，但使用处写法极不一致：
  * 在 `ContentBlock.astro` 中作为同步函数直接调用。
  * 在 `[slug].astro` 和 `index.astro` 中使用了 `await getSiteSettings()`。
  * 在 `SiteLayout.astro` 中甚至使用了 `navCategories ? Promise.resolve(navCategories) : getCategories()` 与 `Promise.all` 进行冗余的 Promise 包装。
* **修复建议：**
  统一代码风格，如果数据读取无需异步 I/O，移除多余的 `Promise.resolve` 与 `await`，直接同步取值。

---

## 二、 中等优先级与潜在风险项（5 项）

### 5. 首页封面图 `alt` 属性大面积缺失（无障碍 / Accessibility 缺陷）
* **定位文件：** `src/data/content/site.json`
* **问题描述：**
  首页配置的 6 张大图封面中，有 5 张的 `alt` 字段为空字符串 `""`。虽然能正常渲染，但对读屏辅助设备不友好，不符合 Web Content Accessibility Guidelines (WCAG) 基础规范。
* **优化建议：**
  补齐 5 张封面的简要描述，或者在管理端保存时给予无障碍提示。

---

### 6. 摄影图集 Lightbox 计算迭代循环潜在布局抖动
* **定位文件：** `src/lib/content/photography-lightbox.js`（第 151–158 行）
* **问题描述：**
  在 `resizeFrame` 中，为了兼顾说明文本高度与图片比例，采用了最多 3 次的 `for` 循环：
  ```javascript
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const descriptionHeight = measureDescriptionHeight(width);
    // ...
    if (Math.abs(nextWidth - width) < 0.5) break;
    width = nextWidth;
  }
  ```
  在单次计算中多次变更 `caption.style` 并读取 `getBoundingClientRect()`，可能触发多次强制同步布局（Forced Synchronous Layout / Reflow）。
* **优化建议：**
  可通过纯 CSS 弹性布局约束（例如 `flexbox` 结合 `min-height: 0`）或缓存说明文本预估高度来避免重复触发布局计算。

---

### 7. 自适应 Favicon 在潜在跨域场景下的画布污染
* **定位文件：** `src/scripts/adaptive-favicon.ts`
* **问题描述：**
  深色模式自适应 Favicon 是通过动态绘制到 `<canvas>` 提取像素反转颜色实现的。当前图标存储在本地 `public/` 下正常运作，但未来若将静态资源迁至 CDN 且未配置 CORS 头，调用 `context.getImageData()` 会触发跨域安全异常导致画布污染。
* **优化建议：**
  目前已有 `.catch(() => source)` 保障不崩溃，但可考虑提供预置的深色 Favicon SVG/PNG 资源，通过 `<link rel="icon" media="(prefers-color-scheme: dark)">` 纯 HTML 原生方式声明，免除 JS 像素处理。

---

### 8. 轮播计时器漂移问题
* **定位文件：** `src/scripts/home-carousel.ts`（第 43–49 行）
* **问题描述：**
  轮播采用链式 `setTimeout` 实现，在浏览器切到后台标签页或主线程受阻塞时，定时触发会产生累积误差。
* **优化建议：**
  对于普通作品展示影响有限，但若需严格定时，可结合统一的调度管理或在 `document.visibilityState` 恢复时主动对齐时间戳。

---

### 9. 内容语言判断依赖正则字符集存在边缘误判
* **定位文件：** `src/lib/content/work-body-sections.js`（第 13–21 行）
* **问题描述：**
  ```javascript
  if (work.articleLanguage === 'ja' || work.articleLanguage === 'zh') return work.articleLanguage;
  // ...
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'; // 假名判定
  if (/[\u3400-\u9fff]/.test(text)) return 'zh'; // CJK 汉字判定
  ```
  若日文内容通篇以汉字书写（如名册、特定学术标题、短语摘录），可能被误判为 `zh`，从而应用中文字体排版规范。
* **优化建议：**
  建议在内容编辑录入时明确绑定 `articleLanguage`，正则仅作为兜底策略。

---

## 三、 架构设计与代码质量优化建议（4 项）

### 10. `PuckWorkEditor.jsx` 单文件体积过大（2,937 行）
* **定位文件：** `src/components/admin/PuckWorkEditor.jsx`
* **问题描述：**
  单文件集成了画布配置、各个组件的 Field 转换、拖拽交互、内联样式面板、裁剪交互及状态同步等全部逻辑，复杂度较高。
* **优化建议：**
  建议按功能拆分模块：
  * `PuckConfig/`（各 Block 的渲染与配置解耦）
  * `EditorPanels/`（文字样式面板、图片裁剪、链接弹窗等抽离）
  * `hooks/`（撤回重做、历史记录管理等自定义 Hook）

---

### 11. TypeScript 与 JavaScript 混用规范
* **定位文件：** `src/lib/content/` 目录下同时存在 `.ts` 与 `.js`
* **问题描述：**
  核心逻辑如 `media-row.js`、`photography-lightbox.js`、`work-thumbnail.js` 为纯 JS，未开启严格类型校验，无法在编译期自动捕获属性命名变更或空值隐患。
* **优化建议：**
  逐步统一迁移至 `.ts`，为排版计算和媒体模型建立完整的类型声明。

---

### 12. `ContentBlock.astro` 职责过度集中（148 行复合渲染）
* **定位文件：** `src/components/content/ContentBlock.astro`
* **问题描述：**
  单一模板内使用大段三元与条件渲染承载了十余种内容块的排版结构。
* **优化建议：**
  将 `imageCarousel`、`mediaComposition`、`specifications` 等复杂块单独拆分为子 Astro 组件，让入口只负责分发派发。

---

### 13. 数据契约统一
* 对 `src/data/content/works/` 中的作品数据结构建立自动化 Schema 校验（如 Zod 或 JSON Schema），在构建前确保所有作品字段完整性，防范漏填、错填。
