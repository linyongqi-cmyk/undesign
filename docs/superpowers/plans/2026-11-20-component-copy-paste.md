# 组件快捷复制与跨作品粘贴实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台详情画布中用 ⌘/Ctrl+C、⌘/Ctrl+V 复制组件，并在当前管理页会话中的其他作品粘贴。

**Architecture:** 新增纯函数模块捕获 Puck 组件及其后代 zones，并生成新组件 ID、插入目标 zone；模块级剪贴板跨作品画布重挂载保留内容。Puck 内的键盘桥接处理快捷键并派发单个 `setData` 草稿更新，使用已有全局历史与保存流程。

**Tech Stack:** Astro 本地管理页、React、Puck、Node.js `node:test`。

**Spec:** `docs/superpowers/specs/2026-11-20-component-copy-paste-design.md`

## Global Constraints

- 只复制一个已选组件；保留组件 props、嵌套组件、zone 和媒体引用。
- 组件剪贴内容在当前管理页会话跨作品保留，刷新或关闭后清空。
- 粘贴在已选组件之后；无选择时追加到模板主要内容区，图文分栏目标为右侧内容区。
- 输入框、文本区、可编辑文字和已有文本选区使用浏览器原生剪贴行为。
- 不修改前台渲染或作品数据源；产品版本仅递增后台 PATCH。

## Review Focus

- 不同作品或模板之间粘贴：集成步骤核对复制缓冲不依赖源画布，空选择会落到正确主 zone。
- 组件拥有嵌套 drop zone：单元测试验证整个子树的 ID 与 zone key 同步重映射。
- 富文本正在编辑或页面有文本选区：集成步骤验证不拦截原生复制/粘贴。
- 快速连续粘贴：浏览器检查验证每次生成新 ID，副本可以连续插入。
- 空剪贴板或无选中项：单元测试验证复制无副作用，粘贴不派发/不改数据。

---

### Task 1: Puck 组件剪贴数据操作

**Files:**
- Create: `src/lib/admin/component-clipboard.js`
- Test: `src/lib/admin/component-clipboard.test.js`

**Interfaces:**
- Produces: `copyPuckComponent(data, selector)` 返回独立的 `{ component, zones }` 快照或 `null`；`pastePuckComponent(data, selector, clipboard, fallbackZone, createId)` 返回 `{ data, selector }` 或 `null`。
- Zone `'root'` 对应 `data.content`；其它 zones 位于 `data.zones`。ID 工厂可注入以供确定性测试。

- [x] 写 RED 测试：复制组件及子 zone、插入后代 ID/zone key 重建、选中项后插入、无选择追加主 zone、无效来源/空剪贴板不改变数据。
- [x] 用 `node --test src/lib/admin/component-clipboard.test.js` 运行并确认失败原因对应未实现行为。
- [x] 实现复制子树快照、递归重建 ID 和按目标 zone 插入。
- [x] 重跑该 Node 测试文件并确认通过。

### Task 2: Puck 快捷键桥接与跨作品缓冲

**Files:**
- Modify: `src/components/admin/PuckWorkEditor.jsx`
- Modify: `src/lib/admin/component-clipboard.js`

**Interfaces:**
- 消费 Task 1 的 `copyPuckComponent`、`pastePuckComponent` 和模块级剪贴板读写接口。
- Puck bridge 从 `usePuck()` 读取 `appState.data`、`appState.ui.itemSelector` 和 `getItemBySelector`，通过已有 dispatch ref 写入单个 `setData` 更新，再选择插入的组件。

- [x] 给 Puck bridge 接入 Ctrl/Cmd+C/V；忽略输入控件、contenteditable 和非空文本选区。
- [x] 粘贴目标优先当前选择的后继位置；没有选择时按模板选 root 内容 zone 或 `root:right`。
- [x] 用剪贴事件处理快捷键并写入轻量文本触发标记，保留文本控件的浏览器原生剪贴行为。

### Task 3: 构建与浏览器核对、项目记录

**Files:**
- Modify: `交接.md`
- Modify: `修改记录.md`

- [x] 用后台浏览器从 Product「1」复制图片组件，切换至 Product「樓」粘贴；确认插入并撤回。
- [x] 在 B 画布验证撤回；在 Type 文本字段验证原生复制/粘贴。重做未验证。
- [x] 运行 `npm run build` 并确认 28 页静态构建成功。
- [x] 仅递增后台 PATCH 版本，更新交接状态与本次修改记录；不发布或推送。
