# 分类列表展示方式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 分类可选择网格、瀑布流和研究日志列表，瀑布流封面独立裁切。
**Architecture:** 扩展分类 kind 的 masonry 值；提取前台与管理预览共用的封面布局计算，保留现有方形字段并为瀑布流添加独立设置。
**Tech Stack:** Astro、React、原生 JavaScript/CSS。
**Spec:** docs/superpowers/specs/2026-11-19-category-layout-design.md

## Global Constraints

Product 保持方形网格；不改详情内容；不覆盖旧裁切；16px 间距；支持保存和撤回；不推送和发布。

## Review Focus

旧字段缺省回退；零作品或缺封面；横竖与超长图片；响应式重排与延迟加载；研究模式切换后正文和路由完整。

### Task 1: 分类数据与路由
- [x] 扩展 src/lib/content/types.ts 及 scripts/local-admin 的分类选择与保存校验，增加 masonry。
- [x] 更新 src/pages/works/[category]/[slug].astro、src/pages/sitemap.xml.ts 和管理编辑入口中仅允许 grid 的条件，令 masonry 也可进入详情。
- [x] 更新 Visual、Photography 分类配置；核对 Product、Research 不变。

### Task 2: 封面与排列
- [x] 扩展 src/components/admin/PuckWorkEditor.jsx 的 ThumbnailEditor 与 src/lib/admin/puck-work-document.js 双向转换，独立保存 masonry 封面比例、缩放、位置；纳入历史与保存。
- [x] 在 src/lib/content 下实现共享最短列布局及尺寸预留，接入 src/pages/works/[category].astro 和 scripts/local-admin/preview.js；沿用全局断点与间距。
- [x] 在管理画布与前台验证切换模式、裁切、保存重读、撤回和详情跳转。

### Task 3: 验证与交付
- [x] 检查桌面、手机、缺图、空列表、原图与自定义裁切比例；重排不重置作品顺序。
- [x] 运行 npm run build，确认详情路由及站点地图。
- [x] 更新 WORKFLOW.md，简短说明管理选项与独立裁切；报告实际检查结果。
