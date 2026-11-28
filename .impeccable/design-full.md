---
name: LIN YONGQI 作品集
description: 大幅摄影、轻量排版和灰阶界面组成的作品集与本地编辑器。
colors:
  primary: "#202020"
  page: "#fbfbfa"
  page-divider: "#d8d8d6"
  work-body: "#555555"
  admin-text: "#30302e"
  admin-muted: "#777777"
  admin-border: "#d8d8d5"
  admin-field: "#ffffff"
  admin-subtle: "#efefed"
typography:
  navigation:
    fontFamily: 'Inter, "Noto Sans JP", sans-serif'
    fontSize: "18px"
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: "0.02em"
  work-body:
    fontFamily: "Noto Sans JP"
    fontSize: "14px"
    fontWeight: 300
    lineHeight: 1.8
  admin-label:
    fontSize: "10px"
  admin-control:
    fontSize: "11px"
  admin-section-title:
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  admin-dialog-title:
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  admin-control: "2px"
spacing:
  work-grid-gap: "16px"
  work-block-gap: "12px"
  work-group-gap: "0px"
  media-caption-default: "4px"
  admin-label-gap: "4px"
  admin-field-gap: "8px"
  admin-panel-padding: "12px"
components:
  admin-button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.admin-field}"
    rounded: "{rounded.admin-control}"
    typography: "{typography.admin-control}"
    padding: "6px 10px"
  admin-input:
    backgroundColor: "{colors.admin-field}"
    textColor: "{colors.admin-text}"
    rounded: "{rounded.admin-control}"
    typography: "{typography.admin-control}"
    padding: "6px 8px"
---

# LIN YONGQI 设计说明

## Overview

前台让作品图片占据主要视野。大幅摄影封面、桌面左侧导航、黑白缩略图和留白构成浏览节奏。进入作品后，图片与轻量正文并置，作品图片保留自身色彩。

本地管理窗口使用紧凑的灰阶界面。顶栏负责全局操作，左栏切换页面和作品，中间是画布，右栏提供当前作品字段和可添加的组件。编辑控件置于作品内容布局之外。

## Colors

- 前台以近白为底、近黑为导航和主要文字，浅灰细线用来分隔内容。首页导航随封面切换深浅样式。正文和备注颜色来自作品文字预设。
- Product 方形缩略图默认灰阶，鼠标悬停时恢复原色并显示标题。详情中的图片保留自己的明暗和颜色。
- 管理控件使用白色输入面、浅灰边框和深色确认按钮。灰阶之外，拖放目标等操作反馈保留其专用颜色。前台分隔线与管理控件边框各自沿用现有色值。

## Typography

- 前台导航使用轻字重，当前页面或分类加重。作品正文现行预设为 Noto Sans JP，备注、规格和链接分别沿用各自的全站预设。
- 管理窗口使用共享 UI 字体栈。字段标签、控件、侧栏标题和独立弹窗标题各有字号层级。设置项保留用户保存的字体、字号与字重，画布按作品预设渲染。

## Layout

- 桌面固定左栏宽约 20vw，主内容距顶部 100px；右侧留白随视口调整。首页摄影封面铺满视口。
- Product 桌面为四列方形网格，900px 及以下为三列，720px 及以下为两列。Visual 与 Photography 按各自的缩略图比例排瀑布流。Research Log 用细线分隔可展开条目。
- 图文分栏在桌面上以大图和文字并排，列间距为 48px；720px 及以下换成折叠菜单和单列，文字在图片前。摄影模板保有各自的图片布局与尺寸设置。
- 作品独立区块之间保留 12px，连续内容群组内部为 0，媒体与说明之间使用该媒体自己的设置。管理控件的间距沿用 [管理 UI 控件规范](docs/feature-specs.md#管理-ui-控件规范)。

## Elevation & Depth

作品列表和详情的层次主要由图片、留白与细线形成。窄屏导航抽屉和管理弹层使用轻阴影。摄影查看器以半透明模糊背景使图片从底页中显出，选中或聚焦的管理控件保留现有边框或轮廓。

## Shapes

作品网格以方形裁切为主，瀑布流和详情使用各自的图片比例。管理输入与常规按钮采用小圆角和细边框。常规操作图标为 16px、1.5px 线条，端点和连接处使用圆角。图标按钮按边框盒居中，图标加文字时按整组居中。

## Components

- **前台导航与封面。** 导航层级依靠缩进和字重；首页以淡入淡出切换摄影封面，圆点标记当前图片。
- **作品缩略图。** 方形网格与瀑布流复用缩略图呈现。封面裁切、宽高比和鼠标悬停反馈随列表类型保留。
- **媒体与说明。** 说明位于媒体上方或下方，沿用备注预设；确有说明才占位。摄影查看器的逐图说明沿用其独立规则。
- **管理按钮与字段。** 主要确认使用深底浅字，常规控件用细边框。文本、下拉和数值控件使用统一的常规高度，带单位、范围及多行字段保留自身尺寸和交互。
- **管理工具栏与弹层。** 设置、更换、删除等编辑动作放在作品边界外。设置用小型弹层展开，独立裁切窗口保留预览和确认操作。操作反馈集中在顶栏。

## Do's and Don'ts

- 保留当前首页封面、侧栏导航、缩略图、留白与详情图文层级。
- 保留同类管理控件的字号、线条和交互反馈，并在画布之外布置辅助控件。
- 按同一份作品数据核对前台与画布的顺序、字号、裁切和间距。
- 避免用管理控件的样式覆盖作品内容。避免用单一间距覆盖独立区块、连续群组和媒体说明三种排版关系。
