# 摄影图集上下两区实现计划

> **实施方式：** 当前工作区内由本会话逐项实施；按用户项目规则不添加或运行测试，使用 `npm run build` 和本地页面核对。

**目标：** 摄影详情页固定标题下分为可调宽度的普通组件区与可画布添加、排序的双列图库区，并确保画布和前台一致。

**架构：** 继续将正文存入 Puck `content`，图库存入现有 `root.props.gallery` / `work.gallery`；新增 `photographyIntroWidth`（vw）保存上部宽度。画布添加/排序直接更新 gallery 数组，前台和画布共享摄影图库布局样式与排序数据。

**技术栈：** Astro、React、Puck、CSS、现有本地 JSON 保存转换。

**设计说明：** `docs/superpowers/specs/2026-11-20-photography-gallery-canvas-design.md`

## 全局约束

- 标题固定；上部宽度默认 45vw，普通 Puck 组件可按当前拖拽逻辑排列。
- 下部只渲染图库图片，两列瀑布流，图库按钮添加，画布内拖动排序。
- 摄影图库图片复用图片替换、裁切、说明和链接操作；隐藏整体缩进、显示模式和悬停放大；兼容并保留旧图数据。
- 摄影模板不显示群组创建工具；其他模板保持现状。
- 画布和前台所见即所得；辅助控件不得影响作品内容尺寸。
- 运行 `npm run build` 并检查本地相关页面；不运行额外测试，不发布或推送。

## 文件职责

- `src/lib/admin/puck-work-document.js`、`src/lib/content/types.ts`、`scripts/local-admin/storage.mjs`：摄影上部宽度在作品 JSON 和 Puck 文档之间往返并校验；保留既有 gallery 顺序与图片字段。
- `src/components/admin/PuckWorkEditor.jsx`：摄影画布图库按钮、文件选择与追加、图片拖动排序、复用普通图片编辑操作、上部宽度控件、摄影模板群组入口开关。
- `src/pages/works/[category]/[slug].astro`：摄影前台标题/上部/下部结构及图片能力限制。
- `src/lib/content/photography-gallery-layout.js`：在画布更新前恢复瀑布流移动的图库 DOM 节点，避免 React 对账与外部重排冲突。
- `src/styles/global.css`：前台摄影区尺寸、图库两列/小屏单列和图片区视觉规则。
- `scripts/local-admin/styles.css`：画布的摄影两区对齐与不占位的编辑辅助控件样式。
- `交接.md`、`修改记录.md`：完成时记录结果、检查、版本与发布状态。

## 审查重点

- 已有 `gallery` 作为空数组时仍保留画布添加入口，取消文件选择不留下空图。
- 修改 `photographyIntroWidth` 后保存、重载和转换往返仍为同一值；旧作品默认 45vw。
- 画布拖动图库顺序不改变图片说明、裁切、替代文字和链接；前台使用相同顺序。
- 摄影图库图片携带旧缩进、固定高度或 hoverZoom 数据时，画布和前台均不应用这些展示功能。
- 摄影模板隐藏群组创建工具，但其他模板可用性不变。

---

### Task 1：摄影模板的数据与画布交互

**文件：** 修改 `src/lib/admin/puck-work-document.js`、`src/lib/content/types.ts`、`scripts/local-admin/storage.mjs`、`src/components/admin/PuckWorkEditor.jsx`、`src/lib/content/photography-gallery-layout.js`、`scripts/local-admin/styles.css`。

- [x] 转换层读取 `work.photographyIntroWidth`，缺省 45；保存 Puck `root.props.photographyIntroWidth` 到作品数据，并在摄影模板切换时保留 gallery 与宽度。
- [x] 摄影模板不展示右侧图库数组字段；通过画布图库按钮打开图片文件选择/上传，成功后按顺序追加 gallery 项，取消时不修改数据。
- [x] 图库项目复用普通图片组件的替换、裁切、说明和图片链接操作；不提供整体缩进、显示模式/宽度或悬停放大设置。
- [x] 画布图库项目提供原生拖动排序，更新前将瀑布流 DOM 节点复位到 React 列表容器；未能通过浏览器接口验证实际鼠标手势。
- [x] 添加画布“上部宽度”控件，默认 45vw，写入 root 属性；画布和前台内容宽度使用相同的 vw 值。
- [x] 摄影模板隐藏群组创建栏，其他模板继续显示。
- [x] 管理画布空图库仍显示添加按钮；编辑按钮以绝对定位/覆盖式控件呈现，不改变图库及上部布局。

### Task 2：前台结构、双端一致性与交付记录

**文件：** 修改 `src/pages/works/[category]/[slug].astro`、`src/styles/global.css`、必要时微调 `scripts/local-admin/styles.css`；更新 `交接.md`、`修改记录.md`。

- [x] 固定标题下渲染 45vw（或保存值）的普通组件区，再渲染占满页面可用宽度的图库区。
- [x] 图库图片区忽略 blockIndent、displayWidth/displayHeight 和 hoverZoom；保留图片说明、裁切、链接文字和 gallery 顺序。
- [x] 前台两列瀑布流与画布核对：一年間の記憶现有已保存 5 张图库图片；两端共用 `distributePhotographyGallery`，按同一图片比例分列，浏览器确认列归属和列内顺序一致。手机单列未验证。
- [x] 本地检查画布添加入口、图片编辑操作、前台/画布宽度及图库间距；实际鼠标拖拽排序未验证。修复画布图库每项纵向 12px 间距。
- [x] `npm run build` 成功生成 28 页；前端 1.3.2，管理端 1.2.2。未运行测试，仅本地修改、不发布。
