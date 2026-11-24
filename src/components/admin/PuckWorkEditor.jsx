import { workThumbnail, thumbnailImageStyle } from '../../lib/content/work-thumbnail.js';
import { showEditorFeedback } from '../../lib/admin/editor-feedback.js';
import CanvasActionMenu, { CanvasMenuContext } from './CanvasActionMenu.jsx';
import { CanvasViewportContext, MobileHiddenPlaceholder, MobileOverrideBar, readSavedCanvasViewport, saveCanvasViewport } from './MobileOverrideControls.jsx';
import { blockIndentValue } from '../../lib/content/block-indent.js';
import { hasMobileImageCrop, mobileWrapProps, normalizeMobileOverride } from '../../lib/content/mobile-override.js';
import { mediaCaptionStyle, photographyLightboxStyle } from '../../lib/content/media-caption-style.js';
import ImageHoverSettings from './ImageHoverSettings.jsx';
import { adminActionPaths } from '../../lib/admin/action-icons.js';
import { displayWidthStyle, itemRatio as layoutItemRatio, layoutAvailableWidth, observeLayoutGroups, updateLayoutGroups } from '../../lib/content/layout-group.js';
import { freeSizeItemZone, sourceCardAspect, sourceCardDisplayText, sourceCardLinkPrompt, sourceCardText, validExternalUrl } from '../../lib/content/free-media.js';
import TextColorPicker from './TextColorPicker.jsx';
import { createPortal } from 'react-dom';
import React, { createContext, useContext, useId, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Drawer, DropZone, Puck, registerOverlayPortal, usePuck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { workToPuckDocument } from '../../lib/admin/puck-work-document.js';
import { switchPuckTemplate } from '../../lib/admin/template-transition.js';
import { copyPuckComponent, getComponentClipboard, pastePuckComponent, setComponentClipboard } from '../../lib/admin/component-clipboard.js';
import { applyMediaPlacement, findBlockById, getPlacementCapabilities, pruneEmptyGroups, ungroupLayout } from '../../lib/admin/puck-media-placement.js';
import { bindMediaRow, bindOverflowRow, getOverflowTextLayout, isEqualHeightMediaRow, overflowRowSettings } from '../../lib/content/media-row.js';
import { focusParagraphEditor, pasteEditorText, readEditorParagraphs, writeEditorParagraphs } from '../../lib/admin/paragraph-editor.js';
import { openImageCropEditor } from '../../lib/admin/image-crop-editor.js';
import { resolvePhotographyLightboxFocusTarget } from '../../lib/admin/photography-lightbox-focus.js';
import { alignMediaCaptionRows } from '../../lib/content/media-caption-layout.js';
import { imageLinkLabel, mediaCaption, mediaCaptionMaxGap, mediaCaptionMinGap, mediaCaptionSettings } from '../../lib/content/media-caption.js';
import { distributePhotographyGallery } from '../../lib/content/photography-gallery-layout.js';
import { openPhotographyLightbox } from '../../lib/content/photography-lightbox.js';
import { videoEmbedSource } from '../../lib/content/video-embed.js';

function textItems(text = '') {
  return (Array.isArray(text) ? text : [text]).map((value, index) => ({ text: value || '', key: `paragraph-${index + 1}` }));
}

function selectOptions(paths = []) {
  return [{ label: '未选择', value: '' }, ...paths.map((src) => ({ label: src.split('/').at(-1), value: src }))];
}

function previewTextStyle(preset = {}, articleLanguage = '', variant = '') {
  const fonts = { 'system-sans': 'Arial, "Yu Gothic", sans-serif', 'system-serif': 'Georgia, "Yu Mincho", serif', 'noto-sans-jp': '"Noto Sans JP", "Yu Gothic", sans-serif', 'noto-sans-sc': '"Noto Sans SC", "PingFang SC", sans-serif', monospace: 'monospace' };
  const languageFont = articleLanguage === 'zh' ? fonts['noto-sans-sc'] : fonts['noto-sans-jp'];
  return {
    fontFamily: ['paragraph', 'subheading', 'note'].includes(variant) && ['ja', 'zh'].includes(articleLanguage) ? languageFont : fonts[preset.fontFamily] || fonts['system-sans'],
    fontSize: Number(preset.fontSize) || 14,
    fontWeight: Number(preset.fontWeight) || 300,
    color: preset.color || '#555555',
    '--text-decoration': preset.textDecoration || 'none',
    lineHeight: Number(preset.lineHeight) || 1.8,
    letterSpacing: (Number(preset.letterSpacing) || 0) + 'px',
    textAlign: preset.textAlign || 'left',
    textDecoration: preset.textDecoration || 'none',
    fontStyle: preset.fontStyle || 'normal',
    textTransform: preset.textTransform || 'none',
    writingMode: preset.writingMode || 'horizontal-tb',
    padding: `${Number(preset.paddingTop) || 0}px ${Number(preset.paddingRight) || 0}px ${Number(preset.paddingBottom) || 0}px ${Number(preset.paddingLeft) || 0}px`,
    paddingLeft: `calc(${Number(preset.paddingLeft) || 0}px + var(--text-block-indent, 0px))`,
  };
}

const typographyDefaults = { fontFamily: 'system-sans', fontSize: 14, mobileFontSize: 14, fontWeight: 300, color: '#555555', lineHeight: 1.8, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', fontStyle: 'normal', textTransform: 'none', writingMode: 'horizontal-tb', paragraphSpacing: 12, textIndent: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
const typographyTypeByComponent = { ParagraphBlock: 'paragraph', SubheadingBlock: 'subheading', NoteBlock: 'note', SpecificationsBlock: 'specifications', InternalLinkBlock: 'internalLink', ExternalLinkBlock: 'externalLink' };
const typographyLabelByType = { paragraph: '本文', subheading: '本文見出し', note: '注記', specifications: '作品仕様', internalLink: '内部リンク', externalLink: '外部リンク' };

export function PuckTextStylePanel({ type, style, onClose, onConfirm, onStyleChange, inline = false, fontFamilyDisabled = false }) {
  const [draft, setDraft] = useState(() => ({ ...typographyDefaults, ...(style || {}) }));
  const [saving, setSaving] = useState(false);
  const stylePanel = useRef(null);
  useEffect(() => {
    if (inline || saving) return;
    const dismiss = event => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [inline, saving, onClose]);
  const setValue = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    onStyleChange?.(key, value);
  };
  const field = (key, label, control) => <label className="puck-text-style-field" key={key}><span>{label}</span>{control}</label>;
  const number = (key, label, min, max, step = 1, suffix = '') => field(key, label, <span className="puck-text-style-number"><input type="number" min={min} max={max} step={step} defaultValue={draft[key] ?? typographyDefaults[key]} required onChange={(event) => {
    if (event.target.validity.valid) { setValue(key, event.target.valueAsNumber); event.target.removeAttribute('aria-invalid'); }
  }} onBlur={(event) => {
    event.target.setAttribute('aria-invalid', String(!event.target.validity.valid));
  }} /><small>{suffix}</small></span>);
  const paddingDirections = [
    ['paddingTop', '上内边距', 'M4 4h12M5 8h10v10H5z'],
    ['paddingBottom', '下内边距', 'M5 2h10v10H5zM4 16h12'],
    ['paddingLeft', '左内边距', 'M4 3v14M8 4h10v12H8z'],
    ['paddingRight', '右内边距', 'M2 4h10v12H2zM16 3v14'],
  ];
  const paddingRows = [paddingDirections.slice(0, 2), paddingDirections.slice(2)];
  const paddingControls = <div className="puck-padding-controls"><span>内边距</span>{paddingRows.map((row, index) => <div className="puck-padding-controls-row" key={`padding-row-${index}`}>{row.map(([key, label, path]) => <label className="puck-padding-control" key={key} title={label}>
    <svg viewBox="0 0 16 20" aria-hidden="true"><path d={path}/></svg>
    <input type="number" min="0" max="200" step="1" value={draft[key] ?? 0} aria-label={label} onChange={(event) => { if (event.target.validity.valid) setValue(key, event.target.valueAsNumber); }} onBlur={(event) => { if (!event.target.validity.valid) event.target.value = draft[key] ?? 0; }} />
  </label>)}</div>)}</div>;
  const select = (key, label, options) => field(key, label, <select value={draft[key] ?? typographyDefaults[key]} disabled={key === 'fontFamily' && fontFamilyDisabled} onChange={(event) => setValue(key, event.target.value)}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>);
  const textStyleChoices = <div className="puck-text-style-field"><span>文字装饰</span><span className="puck-text-style-choices" role="group" aria-label="文字装饰">
    <button type="button" aria-label="下划线" title="下划线" aria-pressed={draft.textDecoration === 'underline'} onClick={() => setValue('textDecoration', draft.textDecoration === 'underline' ? 'none' : 'underline')}><u>U</u></button>
    <button type="button" aria-label="删除线" title="删除线" aria-pressed={draft.textDecoration === 'line-through'} onClick={() => setValue('textDecoration', draft.textDecoration === 'line-through' ? 'none' : 'line-through')}><s>S</s></button>
    <button type="button" aria-label="斜体" title="斜体" aria-pressed={draft.fontStyle === 'italic'} onClick={() => setValue('fontStyle', draft.fontStyle === 'italic' ? 'normal' : 'italic')}><i>i</i></button>
  </span></div>;
  const confirm = async () => {
    const invalid = [...stylePanel.current.querySelectorAll('input,select')].find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    setSaving(true);
    try {
      if (await onConfirm(type, { ...draft, mobileFontSize: draft.fontSize })) { showEditorFeedback('文字样式已应用'); onClose(); }
      else showEditorFeedback('文字样式未应用', { kind: 'error', detail: '请检查输入后重试。' });
    } catch (error) { showEditorFeedback('文字样式应用失败', { kind: 'error', detail: error.message || '请重试。' }); }
    finally { setSaving(false); }
  };
  return <section ref={stylePanel} className={inline ? 'puck-text-style-inline' : 'puck-text-style-panel'} role={inline ? undefined : 'dialog'} aria-label="编辑文字样式">
    {!inline && <header className="puck-text-style-panel-heading"><h3>编辑文字样式</h3>
      <button type="button" className="admin-icon-button" aria-label="取消" title="取消" onClick={onClose} disabled={saving}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <button type="button" className="admin-icon-button style-confirm" aria-busy={saving} aria-label={saving ? '正在应用文字样式' : '确认并应用'} title={saving ? '正在应用…' : '确认并应用'} onClick={confirm} disabled={saving}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
    </header>}
    {!inline && <div className="puck-text-style-sample" style={{ ...previewTextStyle(draft), textAlign: 'center', margin: 0 }}>{typographyLabelByType[type]}</div>}
    <div className="puck-text-style-fields">
      {select('fontFamily', '字体', [['system-sans', '系统无衬线'], ['system-serif', '系统衬线'], [inline ? 'Noto Sans JP' : 'noto-sans-jp', 'Noto Sans JP'], ['monospace', '等宽字体'], ...(inline ? ['Hiragino Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei'].map(font => [font, font]) : [])])}
      <div className="puck-text-style-row">{number('fontSize', '字号', 8, 96, 1, 'px')}{select('fontWeight', '字重', [[100, '100 极细'], [200, '200'], [300, '300 细'], [400, '400 常规'], [500, '500 中等'], [600, '600 半粗'], [700, '700 粗'], [800, '800 特粗']])}</div>
      <div className="puck-text-style-row">{number('lineHeight', '行高', 1, 3, 0.05, '倍')}{number('letterSpacing', '字间距', -2, 12, 0.1, 'px')}</div>
      <div className="puck-text-style-row">{number('paragraphSpacing', '段落间距', 0, 64, 1, 'px')}<TextColorPicker color={draft.color} onChange={(color) => setValue('color', color)} /></div>
      {paddingControls}
      <div className="puck-text-style-row puck-text-style-choice-row"><div className="puck-text-style-field"><span>对齐</span><div className="puck-text-style-choices" role="group" aria-label="对齐">
        {[
          ['left', '左对齐', 'M4 5h16M4 10h10M4 15h16M4 20h10'],
          ['center', '居中', 'M4 5h16M7 10h10M4 15h16M7 20h10'],
          ['right', '右对齐', 'M4 5h16M10 10h10M4 15h16M10 20h10'],
          ['justify', '两端对齐', 'M4 5h16M4 10h16M4 15h16M4 20h16'],
        ].map(([value, label, path]) => <button key={value} type="button" className="admin-icon-button" aria-label={label} title={label} aria-pressed={draft.textAlign === value} onClick={() => setValue('textAlign', value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={path}/></svg></button>)}
      </div></div>{textStyleChoices}</div>
    </div>
  </section>;
}

function PuckCarouselSettingsPanel({ seconds, anchor, onClose, onConfirm }) {
  const [value, setValue] = useState(seconds);
  const [saving, setSaving] = useState(false);
  return <form className="puck-carousel-settings" role="dialog" aria-label="图片轮播间隔"
    style={{ '--carousel-right': `${anchor.right}px`, '--carousel-top': `${anchor.top}px` }}
    onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    onPointerDown={(event) => event.stopPropagation()}
    onMouseDown={(event) => event.stopPropagation()}
    onSubmit={async (event) => {
    event.preventDefault();
    setSaving(true);
    try { if (await onConfirm(Number(value))) { showEditorFeedback('轮播间隔已应用'); onClose(); } else showEditorFeedback('轮播间隔未应用', { kind: 'error', detail: '请检查输入后重试。' }); }
    catch (error) { showEditorFeedback('轮播间隔应用失败', { kind: 'error', detail: error.message || '请重试。' }); }
    finally { setSaving(false); }
  }}>
    <div className="puck-carousel-settings-heading"><span>图片轮播间隔</span><button type="button" className="admin-icon-button" aria-label="取消轮播设置" onClick={onClose} disabled={saving}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
    <label className="canvas-field"><span>切换间隔（秒）</span><input type="number" min="0.1" max="5" step="0.1" value={value} required disabled={saving} onChange={(event) => setValue(event.target.value)} /></label>
    <button className="admin-icon-button button-dark" type="submit" aria-busy={saving} aria-label={saving ? '正在应用轮播间隔' : '应用轮播间隔'} title={saving ? '正在应用…' : '应用轮播间隔'} disabled={saving}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
  </form>;
}

const templateOptions = [
  { label: '图文分栏', value: 'splitDetail' },
  { label: '文章阅读', value: 'articleReading' },
  { label: '摄影图集', value: 'photographyGallery' },
  { label: '摄影图集2', value: 'photographyGallery2' },
];

function AdminActionIcon({ name }) {
  return <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={adminActionPaths[name]} />
    {name === 'settings' && <circle cx="12" cy="12" r="3.1" />}
  </svg>;
}

const contentIconPaths = {
  ParagraphBlock: <><path d="M6 6h12M6 10h12M6 14h9M6 18h7" /></>,
  SubheadingBlock: <><path d="M5 6h14M5 12h9M5 18h14" /><path d="M17 10v4" /></>,
  SpecificationsBlock: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9h16M4 14h16M10 9v11" /></>,
  NoteBlock: <><path d="M10 11H5.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H9a1 1 0 0 1 1 1V13a4 4 0 0 1-4 4M20 11h-4.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H19a1 1 0 0 1 1 1V13a4 4 0 0 1-4 4" /></>,
  ImageBlock: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 5-5 3 3 2-2 4 4" /></>,
  MediaCompositionBlock: <><rect x="4" y="3" width="16" height="7" rx="1.2" /><rect x="4" y="14" width="16" height="7" rx="1.2" /></>,
  ImageCarouselBlock: <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="m7 12-2 2 2 2M17 12l2 2-2 2M9 14h6" /></>,
  SourceCardBlock: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7 10h10m-10 4h7" /></>,
  FreeSizeGroupBlock: <><path d="M3 5h6v14H3zm9 0h9v14h-9z" /></>,
  LocalVideoBlock: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
  VideoEmbedBlock: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18m-12 5 2 2m0-2 2-2a2 2 0 0 1 3 3l-2 2" /></>,
  QuoteBlock: <><path d="M10 11H5.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H9a1 1 0 0 1 1 1V13a4 4 0 0 1-4 4M20 11h-4.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H19a1 1 0 0 1 1 1V13a4 4 0 0 1-4 4" /></>,
  InternalLinkBlock: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></>,
  ExternalLinkBlock: <><path d="M13 5h6v6M19 5l-8 8" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
};

function ContentTypeIcon({ name, className = '' }) {
  const isStack = name === 'MediaCompositionBlock';
  const isInternalLink = name === 'InternalLinkBlock';
  return <span className={`puck-content-type-icon${isStack ? ' puck-content-type-icon--stack' : ''}${isInternalLink ? ' puck-content-type-icon--internal-link' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{contentIconPaths[name] || contentIconPaths.ParagraphBlock}</svg>
    {isStack && <span className="puck-content-type-icon-count">↓</span>}
  </span>;
}

const compactPuckOverrides = { actionBar: () => null };

function TemplateControl() {
  const { appState, dispatch } = usePuck();
  const data = appState.data;
  const savedTemplate = data.root?.props?.template;
  const template = templateOptions.some((option) => option.value === savedTemplate) ? savedTemplate : 'articleReading';
  return <div className="puck-template-control"><select aria-label="详情页模板" value={template} onChange={(event) => {
    const nextTemplate = event.target.value;
    dispatch({ type: 'setData', data: (previous) => switchPuckTemplate(previous, nextTemplate) });
  }}>{templateOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><span className="canvas-add puck-template-label">Template</span></div>;
}

function ThumbnailEditor({ category, onUpload }) {
  const { appState, dispatch } = usePuck();
  const fileInputRef = useRef(null);
  const transientPreviewRef = useRef('');
  const props = appState.data.root?.props || {};
  const masonry = category?.kind === 'masonry';
  const [naturalAspect, setNaturalAspect] = useState(1);
  const settings = workThumbnail(props, category?.kind, naturalAspect);
  const update = (values) => dispatch({ type: 'setData', data: (previous) => ({
    root: { ...previous.root, props: { ...previous.root?.props, ...values } },
  }) });
  const src = props.image || '';
  const [previewSrc, setPreviewSrc] = useState(src);
  const displaySrc = previewSrc || src;
  useEffect(() => { setPreviewSrc(src); }, [src]);
  useEffect(() => () => {
    if (transientPreviewRef.current) URL.revokeObjectURL(transientPreviewRef.current);
  }, []);
  const openCrop = () => openImageCropEditor({
    src, aspect: settings.aspect, scale: settings.scale, position: settings.position,
    fixedAspect: !masonry, preserveCenter: masonry, center: props.masonryThumbnail,
    onConfirm: ({ scale, position, aspect, originalAspect, centerX, centerY }) => {
      if (masonry) update({ masonryThumbnail: { ...(originalAspect ? {} : { aspect }), scale, position, centerX, centerY } });
      else update({ imageScale: scale, imagePosition: position });
    },
  });
  const replaceImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    transientPreviewRef.current = preview;
    setPreviewSrc(preview);
    try {
      const uploadedPath = await onUpload?.(file);
      if (uploadedPath) {
        setPreviewSrc(uploadedPath);
        update({ image: uploadedPath, imageScale: 1, imagePosition: 'center', masonryThumbnail: {} });
      } else setPreviewSrc(src);
    } catch {
      setPreviewSrc(src);
    } finally {
      requestAnimationFrame(() => URL.revokeObjectURL(preview));
      transientPreviewRef.current = '';
      event.target.value = '';
    }
  };
  const crop = props.masonryThumbnail || {};
  const knownRatios = [['original', '原图比例'], ['1.5', '3:2'], ['1', '1:1'], ['0.8', '4:5'], [String(2 / 3), '2:3']];
  const ratioValue = crop.aspect ? String(crop.aspect) : 'original';
  return <section className="puck-thumbnail-editor" aria-label="封面缩略图">
    {masonry && <label className="puck-thumbnail-field">封面比例<select aria-label="瀑布流封面比例" value={ratioValue} onChange={(event) => {
      const aspect = event.target.value === 'original' ? undefined : Number(event.target.value);
      update({ masonryThumbnail: { ...(aspect ? { aspect } : {}), scale: 1, position: 'center' } });
    }}>{knownRatios.map(([value, label]) => <option value={value} key={value}>{label}</option>)}{crop.aspect && !knownRatios.some(([value]) => value === ratioValue) && <option value={ratioValue}>自定义比例</option>}</select></label>}
    <figure className="canvas-image canvas-cover-image puck-thumbnail-image">
      <div className="cover-image-viewport" style={{ aspectRatio: settings.aspect }}>
        {displaySrc ? <img src={imageElementSrc(displaySrc)} alt={workTitle(props)} draggable="false" onLoad={(event) => { const image = event.currentTarget; setNaturalAspect(image.naturalWidth / image.naturalHeight || 1); }} style={thumbnailImageStyle(settings)} /> : <span className="cover-image-empty">选择封面图片</span>}
      </div>
      <div className="cover-image-actions">
        <button className="puck-image-action" type="button" aria-label="编辑裁切" title="编辑裁切" disabled={!src} onClick={(event) => { event.stopPropagation(); openCrop(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" /></svg></button>
        <button className="puck-image-action" type="button" aria-label="更换图片" title="更换图片" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg></button>
        <input ref={fileInputRef} className="puck-visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择封面图片" onChange={replaceImage} />
      </div>
    </figure>
  </section>;
}

function imageElementSrc(src) {
  if (/^(?:blob:|data:|https?:\/\/)/i.test(src)) return src;
  return `/${src.replace(/^\//, '')}`;
}

function workTitle(props) { return props.title || ''; }

function updateBlockProps(data, id, updateProps) {
  if (!id) return data;
  const updateBlocks = (blocks = []) => blocks.map((block) => block.props?.id === id
    ? { ...block, props: updateProps(block.props) }
    : block);
  return {
    ...data,
    content: updateBlocks(data.content),
    zones: Object.fromEntries(Object.entries(data.zones || {}).map(([zone, blocks]) => [zone, updateBlocks(blocks)])),
  };
}

function removeEmptyBlockById(data, id) {
  if (!id) return data;
  const content = data.content || [];
  if (content.some((block) => block.props?.id === id && !block.props?.src)) {
    return { ...data, content: content.filter((block) => block.props?.id !== id) };
  }
  for (const [zone, blocks] of Object.entries(data.zones || {})) {
    if (!blocks.some((block) => block.props?.id === id && !block.props?.src)) continue;
    const next = { ...data, zones: { ...data.zones, [zone]: blocks.filter((block) => block.props?.id !== id) } };
    return pruneEmptyGroups(next, zone);
  }
  return data;
}

function focusTextAreaAtEnd(element) {
  if (!element) return;
  element.focus();
  const end = element.value.length;
  element.setSelectionRange(end, end);
  resizeTextArea(element);
}

function resizeTextArea(element) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

function ParagraphEditor({ paragraphs, className, style, label, autoFocus, onCommit, onCancel, onLiveChange, historyField }) {
  const editorRef = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    const unregisterOverlay = registerOverlayPortal(editor, { disableDrag: true });
    if (JSON.stringify(readEditorParagraphs(editor)) !== JSON.stringify(paragraphs)) {
      writeEditorParagraphs(editor, paragraphs);
      if (autoFocus) {
        focusParagraphEditor(editor);
        const selection = editor.ownerDocument.getSelection();
        selection.selectAllChildren(editor.lastElementChild);
        selection.collapseToEnd();
      }
    }
    return unregisterOverlay;
  }, [paragraphs, autoFocus]);

  return <div
    ref={editorRef}
    data-history-field={historyField}
    className={className}
    style={style}
    role="textbox"
    aria-multiline="true"
    aria-label={label}
    contentEditable
    onPaste={pasteEditorText}
    onInput={(event) => { if (!event.nativeEvent.isComposing) onLiveChange?.(readEditorParagraphs(event.currentTarget)); }}
    onCompositionEnd={(event) => onLiveChange?.(readEditorParagraphs(event.currentTarget))}
    onFocus={(event) => focusParagraphEditor(event.currentTarget)}
    onBlur={(event) => {
      if (!cancelled.current) onCommit(readEditorParagraphs(event.currentTarget));
    }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Escape' && !event.nativeEvent.isComposing && onCancel) {
        event.preventDefault();
        cancelled.current = true;
        onCancel();
      }
    }}
  />;
}

function PuckInlineTextBlock({ id, text = [], className, style, paragraphStyle, typographyVariant = '' }) {
  const { appState, dispatch } = usePuck();
  const articleLanguage = appState.data.root?.props?.articleLanguage || '';
  const languageFont = articleLanguage === 'zh' ? '"Noto Sans SC", "PingFang SC", sans-serif' : '"Noto Sans JP", "Yu Gothic", sans-serif';
  const effectiveStyle = typographyVariant && ['ja', 'zh'].includes(articleLanguage) ? { ...style, fontFamily: languageFont } : style;
  return <InlineParagraph historyField={`text:${id}`} text={text} className={className} style={effectiveStyle} paragraphStyle={paragraphStyle} onChange={(nextItems) => {
    dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({
      ...props,
      text: nextItems.map((value, index) => ({ ...props.text?.[index], text: value })),
    })) });
  }} />;
}

function PuckInlineSubheadingBlock({ id, text = '', style }) {
  const { appState, dispatch } = usePuck();
  const viewport = useContext(CanvasViewportContext);
  const [editing, setEditing] = useState(false);
  const articleLanguage = appState.data.root?.props?.articleLanguage || '';
  const languageFont = articleLanguage === 'zh' ? '"Noto Sans SC", "PingFang SC", sans-serif' : '"Noto Sans JP", "Yu Gothic", sans-serif';
  const effectiveStyle = ['ja', 'zh'].includes(articleLanguage) ? { ...style, fontFamily: languageFont } : style;
  const commit = (paragraphs) => {
    setEditing(false);
    const next = paragraphs[0] || '';
    if (next !== text) dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, text: next })) });
  };
  return editing && viewport === 'desktop' ? <ParagraphEditor className="detail-subheading text-style-subheading puck-paragraph-editor" style={effectiveStyle} paragraphs={[text]} historyField={`subheading:${id}`} label="编辑正文小标题" autoFocus onLiveChange={(paragraphs) => { const next = paragraphs[0] || ''; dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, text: next })) }); }} onCommit={commit} onCancel={() => setEditing(false)} />
    : <h2 data-history-field={`subheading:${id}`} className="detail-subheading text-style-subheading puck-inline-editable" style={effectiveStyle} title={viewport === 'mobile' ? undefined : '双击直接编辑'} onDoubleClick={(event) => { if (viewport === 'mobile') return; event.preventDefault(); event.stopPropagation(); setEditing(true); }}>{text || '正文小标题'}</h2>;
}

function InlineParagraph({ historyField, text, className, style, paragraphStyle, onChange }) {
  const viewport = useContext(CanvasViewportContext);
  const [editing, setEditing] = useState(false);
  const items = Array.isArray(text) ? text : [{ text: String(text || '') }];
  const paragraphs = items.map((item) => item.text || '');
  const beginEditing = (event) => {
    if (viewport === 'mobile') return;
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
  };
  const finishEditing = (nextItems) => {
    setEditing(false);
    if (nextItems.length === paragraphs.length && nextItems.every((value, index) => value === paragraphs[index])) return;
    onChange(nextItems);
  };

  return editing && viewport === 'desktop' ? <ParagraphEditor
    className={`${className} puck-paragraph-editor`}
    style={{ ...style, '--editor-paragraph-spacing': paragraphStyle?.(0)?.marginBottom, '--editor-text-indent': paragraphStyle?.(0)?.textIndent }}
    paragraphs={paragraphs}
    label="编辑正文"
    autoFocus
    historyField={historyField}
    onLiveChange={onChange}
    onCommit={finishEditing}
    onCancel={() => setEditing(false)}
  /> : <div data-history-field={historyField} className={`${className} puck-inline-editable puck-inline-document`} style={style} title={viewport === 'mobile' ? undefined : '双击直接编辑'} onDoubleClick={beginEditing}>
    {items.map((item, index) => <p key={item.key || index} style={paragraphStyle?.(index)}>{item.text || <br />}</p>)}
  </div>;
}

function specificationRows(items, dimensions, material, date) {
  if (Array.isArray(items) && items.length) return items.map((item) => ({ label: String(item.label || ''), value: String(item.value || '') }));
  return [
    { label: 'dimensions', value: String(dimensions || '') },
    { label: 'material', value: String(material || '') },
    { label: 'date', value: String(date || '') },
  ];
}

function specificationEditorText(rows) {
  return rows.map((row) => {
    const [firstLine = '', ...continuation] = String(row.value ?? '').split('\n');
    return `${row.label}:${firstLine ? ` ${firstLine}` : ''}${continuation.map((line) => `\n ${line}`).join('')}`;
  }).join('\n');
}

function parseSpecificationLines(text) {
  const rows = [];
  for (const line of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const delimiter = line.indexOf(':');
    if (!/^\s/.test(line) && delimiter >= 0) {
      const value = line.slice(delimiter + 1);
      rows.push({ label: line.slice(0, delimiter), value: value.startsWith(' ') ? value.slice(1) : value });
    } else if (!/^\s/.test(line) && rows.length === 0) {
      rows.push({ label: line, value: '' });
    } else if (rows.length) {
      const continuation = /^ /.test(line) ? line.slice(1) : line;
      rows.at(-1).value += `\n${continuation}`;
    } else if (line) {
      rows.push({ label: line, value: '' });
    }
  }
  return rows;
}

function PuckInlineSpecificationsBlock({ id, ...props }) {
  const { dispatch } = usePuck();
  return <InlineSpecifications historyField={`specifications:${id}`} {...props} onChange={(items) => {
    dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (current) => ({ ...current, items })) });
  }} />;
}

function InlineSpecifications({ historyField, items, dimensions = '', material = '', date = '', style, onChange }) {
  const [editing, setEditing] = useState(false);
  const editorRef = useRef(null);
  const [draft, setDraft] = useState('');
  const rows = specificationRows(items, dimensions, material, date);
  useEffect(() => editing ? registerOverlayPortal(editorRef.current, { disableDrag: true }) : undefined, [editing]);
  const rowsSignature = JSON.stringify(rows);
  useEffect(() => {
    if (!editing || JSON.stringify(parseSpecificationLines(draft)) === rowsSignature) return;
    setDraft(specificationEditorText(rows));
  }, [rowsSignature]);
  const beginEditing = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraft(specificationEditorText(rows));
    setEditing(true);
    window.requestAnimationFrame(() => focusTextAreaAtEnd(editorRef.current));
  };
  const finishEditing = (event) => {
    if (!editing) return;
    const nextRows = parseSpecificationLines(event.currentTarget.value);
    setEditing(false);
    if (JSON.stringify(nextRows) === JSON.stringify(rows)) return;
    onChange(nextRows);
  };
  const restoreAndClose = (event) => {
    event.preventDefault();
    setDraft(specificationEditorText(rows));
    setEditing(false);
    editorRef.current?.blur();
  };
  return editing ? <textarea
    ref={editorRef}
    data-history-field={historyField}
    className="puck-inline-textarea puck-inline-specifications-textarea"
    style={style}
    rows={Math.max(3, rows.length)}
    value={draft}
    aria-label="编辑作品参数"
    onChange={(event) => { setDraft(event.target.value); resizeTextArea(event.target); if (!event.nativeEvent.isComposing) onChange(parseSpecificationLines(event.target.value)); }}
    onCompositionEnd={(event) => onChange(parseSpecificationLines(event.currentTarget.value))}
    onBlur={finishEditing}
    onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') restoreAndClose(event); }}
  /> : <div data-history-field={historyField} className="split-detail-specifications detail-specifications text-style-specifications puck-inline-specifications puck-inline-editable" style={style} title="双击直接编辑" onDoubleClick={beginEditing}>
    {rows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}:</dt>{' '}<dd>{row.value}</dd></div>)}
  </div>;
}

function valueAtPath(target, path) {
  return path.split('.').reduce((value, key) => value?.[Array.isArray(value) ? Number(key) : key], target);
}

function withPathValue(target, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const result = { ...target };
  let source = target;
  let destination = result;
  for (const key of parts) {
    const sourceValue = source?.[Array.isArray(source) ? Number(key) : key];
    const next = Array.isArray(sourceValue) ? [...sourceValue] : { ...(sourceValue || {}) };
    destination[Array.isArray(destination) ? Number(key) : key] = next;
    source = sourceValue;
    destination = next;
  }
  destination[Array.isArray(destination) ? Number(last) : last] = value;
  return result;
}

function imageAspectRatio(editor) {
  const frame = editor?.querySelector('.puck-image-viewport');
  const [frameWidth, frameHeight = 1] = (frame?.style.aspectRatio || '').split('/').map(Number);
  const image = editor?.querySelector('img[src]');
  return frameWidth > 0 && frameHeight > 0 ? frameWidth / frameHeight
    : image?.naturalWidth && image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
}

async function loadedImageAspectRatio(editor) {
  const image = editor?.querySelector('img[src]');
  const ratio = imageAspectRatio(editor);
  if (!image || ratio !== 1 || image.naturalWidth) return ratio;
  const url = image.currentSrc || image.src;
  if (!url) return ratio;
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe.naturalWidth / probe.naturalHeight || 1);
    probe.onerror = () => resolve(1);
    probe.src = url;
  });
}

function fileAspectRatio(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image.naturalWidth / image.naturalHeight || 1); };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(1); };
    image.src = url;
  });
}

async function fixedRowImageFits({ id, rowElement, candidateAspect, appState, getSelectorForId }) {
  const zone = getSelectorForId(id)?.zone || '';
  if (!zone.endsWith(':items')) return true;
  const group = findBlockById(appState.data, zone.slice(0, -':items'.length));
  const items = appState.data.zones?.[zone] || [];
  if (group?.type !== 'LayoutGroupBlock' || group.props?.layout !== 'row' || group.props?.rowMode !== 'fixedHeight'
    || !items.length || items.some((item) => !['ImageBlock', 'SourceCardBlock'].includes(item.type))) return true;
  const row = rowElement?.closest('[data-content-layout="row"][data-image-row-mode="fixedHeight"]');
  if (!row) return true;
  const siblings = [...row.querySelectorAll('.puck-image-editor')].filter((editor) => editor !== rowElement);
  const ratios = await Promise.all(siblings.map(loadedImageAspectRatio));
  ratios.push(...[...row.querySelectorAll('.puck-source-card-editor')].map(() => sourceCardAspect));
  const height = Math.max(80, Number(group.props.rowHeight) || 200);
  const track = row.querySelector('.layout-group-items');
  const gap = parseFloat(track ? getComputedStyle(track).columnGap : '') || 0;
  const projectedWidth = ([...ratios, candidateAspect].reduce((sum, ratio) => sum + ratio * height, 0)) + gap * ratios.length;
  const available = layoutAvailableWidth(row);
  return available <= 0 || projectedWidth <= available + 1;
}

function PuckImageEditor({ id, src = '', alt = '', label = '图片', iconName = 'ImageBlock', showComponentActions = true, onDeleteImage, onImageChange, onNaturalAspect, showActions = true, showImageAdjustments = true, showHoverZoom = true, extraActions, showEmptyAddButton = true, uniformCropAspect = false, uniformComposition = false, imageFieldKey = '', uploadImage, imageListPath = '', imageIndex = -1, hoverZoom, cropAspect, cropScale = 1, cropPosition = 'center', mobileCropAspect, mobileCropScale, mobileCropPosition, mobileBar, caption = '', captionSettings, linkLabel, photographyDescription = '', showPhotographyDescription = false, onPhotographyPreview, showCaption = true, showLink = true }) {
  const viewport = useContext(CanvasViewportContext);
  const imageSizingState = usePuck();
  const blockData = findBlockById(imageSizingState.appState.data, id);
  const displayHeight = blockData?.props?.displayHeight;
  const { appState, dispatch, getSelectorForId } = usePuck();
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(src);
  const [naturalAspect, setNaturalAspect] = useState(null);
  const [imageFitError, setImageFitError] = useState('');
  const transientPreviewRef = useRef('');
  const displaySrc = previewSrc || src;
  const captionValue = showCaption ? mediaCaption({ caption, captionSettings }) : null;
  const previousSrcRef = useRef(src);
  useEffect(() => {
    if (src !== previousSrcRef.current) {
      previousSrcRef.current = src;
      setPreviewSrc(src);
    }
  }, [src]);
  useEffect(() => () => {
    if (transientPreviewRef.current) URL.revokeObjectURL(transientPreviewRef.current);
  }, []);
  const updateImage = (changes) => onImageChange ? onImageChange(changes) : dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => {
    if (imageListPath && imageIndex >= 0) {
      const images = [...(valueAtPath(props, imageListPath) || [])];
      if (uniformComposition && changes.cropAspect !== undefined) {
        const items = (props.items || []).map((item) => item.kind === 'imageCarousel'
          ? { ...item, images: (item.images || []).map((image) => ({ ...image, cropAspect: changes.cropAspect })) }
          : { ...item, image: { ...(item.image || {}), cropAspect: changes.cropAspect } });
        return { ...props, items };
      }
      if (uniformCropAspect && changes.cropAspect !== undefined) {
        return withPathValue(props, imageListPath, images.map((image, index) =>
          index === imageIndex ? { ...image, ...changes } : { ...image, cropAspect: changes.cropAspect }
        ));
      }
      images[imageIndex] = imageFieldKey
        ? { ...images[imageIndex], [imageFieldKey]: { ...(images[imageIndex]?.[imageFieldKey] || {}), ...changes } }
        : { ...images[imageIndex], ...changes };
      return withPathValue(props, imageListPath, images);
    }
    return { ...props, ...changes };
  }) });
  const openCrop = () => openImageCropEditor({
    src: displaySrc, aspect: Number(cropAspect) || naturalAspect || 1, scale: cropScale, position: cropPosition,
    onConfirm: async ({ scale, position, aspect }) => {
      const fits = await fixedRowImageFits({ id, rowElement: editorRef.current, candidateAspect: Number(aspect) || 1, appState, getSelectorForId });
      if (!fits) { setImageFitError('裁切比例会超出画布可用范围，请调低固定高度或选择更窄的比例。'); return; }
      setImageFitError('');
      updateImage({ cropScale: scale, cropPosition: position, cropAspect: aspect });
    },
  });
  const openMobileCrop = () => openImageCropEditor({
    src: displaySrc,
    aspect: Number(mobileCropAspect) || Number(cropAspect) || naturalAspect || 1,
    scale: mobileCropScale ?? cropScale,
    position: mobileCropPosition || cropPosition,
    onConfirm: ({ scale, position, aspect }) => {
      updateImage({ mobileCropScale: scale, mobileCropPosition: position, mobileCropAspect: aspect });
    },
  });
  const resetMobileCrop = () => updateImage({ mobileCropAspect: undefined, mobileCropScale: undefined, mobileCropPosition: undefined });
  const isMobileViewport = viewport === 'mobile';
  const effectiveAspect = isMobileViewport && Number(mobileCropAspect) > 0 ? Number(mobileCropAspect) : Number(cropAspect);
  const effectiveScale = isMobileViewport && mobileCropScale !== undefined ? Number(mobileCropScale) : (Number(cropScale) || 1);
  const effectivePosition = isMobileViewport && mobileCropPosition ? mobileCropPosition : cropPosition;
  const hasMobileCrop = hasMobileImageCrop({ mobileCropAspect, mobileCropScale, mobileCropPosition });
  const replaceImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const candidateAspect = Number(cropAspect) || await fileAspectRatio(file);
    const fits = await fixedRowImageFits({ id, rowElement: editorRef.current, candidateAspect, appState, getSelectorForId });
    if (!fits) {
      setImageFitError('图片比例过宽，超出画布可用范围；请换用更窄的图片或调低固定高度。');
      event.target.value = '';
      return;
    }
    setImageFitError('');
    const preview = URL.createObjectURL(file);
    transientPreviewRef.current = preview;
    setPreviewSrc(preview);
    try {
      const uploadedPath = await uploadImage?.(file);
      if (uploadedPath) {
        setPreviewSrc(uploadedPath);
        updateImage({ src: uploadedPath, cropScale: 1, cropPosition: 'center' });
      } else setPreviewSrc(src);
    } catch {
      setPreviewSrc(src);
    } finally {
      requestAnimationFrame(() => URL.revokeObjectURL(preview));
      transientPreviewRef.current = '';
      event.target.value = '';
    }
  };
  useEffect(() => {
    const editor = editorRef.current;
    const input = fileInputRef.current;
    if (!showActions || !editor || !input) return undefined;
    const actions = editor.querySelector('.puck-image-actions');
    const unregisterOverlay = actions ? registerOverlayPortal(actions, { disableDrag: true }) : undefined;
    const onAction = (event) => {
      const button = event.target.closest('[data-image-action]');
      if (!button || !editor.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.imageAction === 'crop' && displaySrc) openCrop();
      if (button.dataset.imageAction === 'replace' || button.dataset.imageAction === 'add') input.click();
      if (button.dataset.imageAction === 'delete-image') onDeleteImage?.();
      if (button.dataset.imageAction === 'delete') {
        const selector = getSelectorForId(id);
        if (!selector) return;
        dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
      }
    };
    const onCancel = () => {
      input.value = '';
      if (displaySrc) return;
      if (onDeleteImage) {
        onDeleteImage();
        return;
      }
      const selector = getSelectorForId(id);
      if (selector) dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
    };
    editor.addEventListener('click', onAction);
    input.addEventListener('change', replaceImage);
    input.addEventListener('cancel', onCancel);
    return () => {
      unregisterOverlay?.();
      editor.removeEventListener('click', onAction);
      input.removeEventListener('change', replaceImage);
      input.removeEventListener('cancel', onCancel);
    };
  }, [id, displaySrc, cropAspect, cropScale, cropPosition, imageListPath, imageIndex, imageFieldKey, uniformComposition, uploadImage, onDeleteImage, onImageChange, getSelectorForId, dispatch, appState, showActions]);
  return <figure ref={editorRef} data-image-editor data-caption-position={captionValue ? captionValue.position : undefined} className={`puck-detail-image puck-image-editor${displaySrc ? '' : ' is-empty'}`} style={!isMobileViewport && displayHeight ? { width: `${displayHeight * (effectiveAspect || naturalAspect || 1)}px`, maxWidth: "100%" } : undefined}>
    {displaySrc && <CaptionText value={captionValue} position="top" />}
    {displaySrc ? <div className="puck-image-viewport" style={effectiveAspect > 0 || (!isMobileViewport && displayHeight) ? { aspectRatio: `${effectiveAspect || naturalAspect || 1} / 1` } : undefined}><img src={imageElementSrc(displaySrc)} alt={alt || ''} onLoad={(event) => { const image = event.currentTarget; if (image.naturalWidth && image.naturalHeight) { const aspect = image.naturalWidth / image.naturalHeight; setNaturalAspect(aspect); onNaturalAspect?.(aspect); } }} style={{ objectPosition: effectivePosition, transform: `scale(${effectiveScale})`, height: effectiveAspect > 0 || (!isMobileViewport && displayHeight) ? '100%' : 'auto', objectFit: effectiveAspect > 0 ? 'cover' : 'contain' }} />{showLink && <ImageLinkPreview linkLabel={linkLabel} />}</div> : <div className="puck-image-empty"><span>尚未添加图片</span></div>}
    {displaySrc && <CaptionText value={captionValue} position="bottom" />}
    {imageFitError && <small className="puck-image-row-error" role="alert">{imageFitError}</small>}
    {showActions && <div className="puck-image-actions" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      {isMobileViewport ? (mobileBar || (showComponentActions ? <MobileOverrideBar label="图片" mobile={blockData?.props?.mobile} supportsWidth supportsCrop={Boolean(displaySrc)} hasMobileCrop={hasMobileCrop} onChangeMobile={(nextMobile) => dispatch({ type: 'setData', data: (prev) => updateBlockProps(prev, id, (props) => ({ ...props, mobile: nextMobile })) })} onOpenMobileCrop={openMobileCrop} onResetMobileCrop={resetMobileCrop} /> : null)) : <CanvasActionMenu disabled={!displaySrc}>
      {extraActions}
      {showPhotographyDescription && <CanvasPopoverAction label="摄影说明" icon="edit" wide feedbackText="已应用" fields={(close) => <PhotographyDescriptionFields description={photographyDescription} onApply={(value) => updateImage({ photographyDescription: value })} onClose={close} />} />}
      {showPhotographyDescription && onPhotographyPreview && <button className="puck-image-action" type="button" aria-label="预览放大" title="预览放大" onClick={(event) => { event.stopPropagation(); onPhotographyPreview(event.currentTarget, editorRef.current); }}><AdminActionIcon name="zoomIn" /></button>}
      {displaySrc && <>
        {showCaption && <MediaCaptionAction caption={caption} captionSettings={captionSettings} onChange={(patch) => updateImage(captionPatch(patch, { caption, captionSettings }))} />}
        {showLink && <ImageLinkAction linkLabel={linkLabel} onChange={(patch) => updateImage(patch)} />}
        {showImageAdjustments && showHoverZoom && <CanvasPopoverAction label="图片悬停效果" icon="zoomIn" fields={close => <ImageHoverSettings value={hoverZoom} onChange={(value) => { updateImage({ hoverZoom: value }); close(); }} getFrame={() => editorRef.current?.querySelector('.puck-image-viewport')} />} />}
        {showImageAdjustments && <button className="puck-image-action cover-image-action" type="button" data-image-action="crop" aria-label="裁切图片" title="裁切图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" /></svg></button>}
        {showImageAdjustments && <button className="puck-image-action cover-image-action" type="button" data-image-action="replace" aria-label="更换图片" title="更换图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg></button>}
        {showComponentActions && <button className="puck-image-action cover-image-action" type="button" data-image-action="delete" aria-label="删除组件" title="删除组件"><AdminActionIcon name="delete" /></button>}
      </>}
      {!displaySrc && showEmptyAddButton && <button className="puck-image-add" type="button" data-image-action="add">＋ 从电脑选择图片</button>}
      {onDeleteImage && <button className="puck-image-action puck-image-delete-item" type="button" data-image-action="delete-image" aria-label="删除此图片" title="删除此图片"><AdminActionIcon name="delete" /></button>}
      </CanvasActionMenu>}
    </div>}
    {showActions && <input ref={fileInputRef} className="puck-visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" aria-label="从电脑选择图片" />}
  </figure>;
}

function PhotographyGalleryCanvas({ gallery = [], uploadImage, lightboxEnabled = false, layoutVariant = 'columns' }) {
  const { dispatch, appState } = usePuck();
  const typography = useContext(IndentTypographyContext);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(-1);
  const [naturalAspects, setNaturalAspects] = useState({});
  const items = gallery.map((image) => typeof image === 'string' ? { src: image } : image).filter((image) => image?.src);
  const descriptionStyle = photographyLightboxStyle(typography);
  const galleryItems = items.map((image, index) => ({
    image,
    index,
    aspect: Number(image.cropAspect) > 0 ? Number(image.cropAspect) : naturalAspects[image.src] || 1,
  }));
  const columns = layoutVariant === 'singleColumn' ? [galleryItems] : distributePhotographyGallery(galleryItems);
  const rememberAspect = (src, aspect) => {
    if (!(aspect > 0)) return;
    setNaturalAspects((previous) => previous[src] === aspect ? previous : { ...previous, [src]: aspect });
  };
  const updateGallery = (update) => {
    dispatch({ type: 'setData', data: previous => {
    const root = previous.root || {};
    const props = root.props || {};
    const current = (props.gallery || []).map((image) => typeof image === 'string' ? { src: image, alt: '', caption: '' } : image);
    return { ...previous, root: { ...root, props: { ...props, gallery: update(current) } } };
    } });
  };
  const replaceItem = (index, changes) => updateGallery(current => current.map((image, itemIndex) => itemIndex === index ? { ...image, ...changes } : image));
  const removeItem = (index) => updateGallery(current => current.filter((_, itemIndex) => itemIndex !== index));
  const moveItem = (from, to) => updateGallery(current => {
    if (from < 0 || from >= current.length) return current;
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
    return next;
  });
  const addImages = async (event) => {
    const files = [...(event.currentTarget.files || [])];
    event.currentTarget.value = '';
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      const added = [];
      for (const file of files) {
        try {
          const src = await uploadImage?.(file);
          if (src) added.push({ src, alt: '', caption: '', cropScale: 1, cropPosition: 'center' });
        } catch {
          // Keep processing the remaining selected files.
        }
      }
      if (added.length) updateGallery(current => [...current, ...added]);
      const failed = files.length - added.length;
      showEditorFeedback(failed ? `已添加 ${added.length} 张，${failed} 张失败` : `已添加 ${added.length} 张图片`);
    } finally {
      setUploading(false);
    }
  };
  const dropOnEnd = (event) => {
    if (draggedIndex < 0 || event.target.closest('[data-photography-gallery-item]')) return;
    event.preventDefault();
    moveItem(draggedIndex, items.length - 1);
    setDraggedIndex(-1);
  };
  return <div className={`photography-gallery puck-photography-gallery${layoutVariant === 'singleColumn' ? ' puck-photography-gallery--single-column' : ''}`} data-photography-gallery onDragOver={(event) => event.preventDefault()} onDrop={dropOnEnd}>
    <div className="photography-gallery-tools"><button type="button" className="photography-gallery-add" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? '正在添加…' : '＋ 添加图片'}</button><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" multiple onChange={addImages} /></div>
    <div className="photography-gallery-columns" data-photography-gallery-columns>
      {columns.map((columnItems, columnIndex) => <div key={columnIndex} data-photography-gallery-column>{columnItems.map(({ image, index, aspect }) => <div key={`${image.src}-${index}`} className={`media-caption-unit photography-gallery-item${draggedIndex === index ? ' is-dragging' : ''}`} data-photography-gallery-item data-gallery-order={index} data-gallery-aspect={aspect} style={{ '--gallery-order': index, ...(layoutVariant === 'singleColumn' ? { '--photo2-aspect': aspect } : {}) }} draggable onDragStart={(event) => {
        event.dataTransfer?.setData('text/plain', String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        setDraggedIndex(index);
      }} onDragEnd={() => setDraggedIndex(-1)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const from = Number(event.dataTransfer?.getData('text/plain'));
        if (Number.isInteger(from)) moveItem(from, index);
        setDraggedIndex(-1);
      }}>
        <PuckImageEditor id={`photography-gallery-${index}`} src={image.src} alt={image.alt || ''} caption={image.caption || ''} captionSettings={image.captionSettings} cropAspect={image.cropAspect} cropScale={image.cropScale} cropPosition={image.cropPosition} linkLabel={image.linkLabel} photographyDescription={image.photographyDescription || ''} showPhotographyDescription={lightboxEnabled} onPhotographyPreview={(trigger, editor) => openPhotographyLightbox({ items: items.map((entry, itemIndex) => ({ ...entry, id: `gallery-${itemIndex}`, aspect: Number(entry.cropAspect) || naturalAspects[entry.src] || 1, element: document.querySelector(`[data-photography-gallery-item][data-gallery-order="${itemIndex}"]`) })), startId: `gallery-${index}`, baseUrl: import.meta.env.BASE_URL, descriptionStyle, returnFocus: resolvePhotographyLightboxFocusTarget(editor, trigger), frameSelector: '.puck-image-viewport' })} uploadImage={uploadImage} onImageChange={(changes) => replaceItem(index, changes)} onDeleteImage={() => removeItem(index)} onNaturalAspect={(value) => rememberAspect(image.src, value)} showComponentActions={false} showHoverZoom={false} />
      </div>)}</div>)}
    </div>
  </div>;
}

function PhotographyGallery2ImageBlock({ id, src = '', alt = '', hoverZoom, cropAspect, cropScale = 1, cropPosition = 'center', caption = '', captionSettings, linkLabel, photographyDescription = '', uploadImage }) {
  const { appState } = usePuck();
  const typography = useContext(IndentTypographyContext);
  const [naturalAspect, setNaturalAspect] = useState(1);
  const aspect = Number(cropAspect) > 0 ? Number(cropAspect) : naturalAspect || 1;
  const zone = appState.data.zones?.['root:photographyGallery2Right'] || [];
  const index = zone.findIndex((block) => block.props?.id === id);
  const lightboxEnabled = appState.data.root?.props?.photographyLightboxEnabled === true;
  if (index < 0) {
    const imageEditor = <PuckImageEditor id={id} src={src} alt={alt} hoverZoom={hoverZoom} cropAspect={cropAspect} cropScale={cropScale} cropPosition={cropPosition} caption={caption} captionSettings={captionSettings} linkLabel={linkLabel} photographyDescription={photographyDescription} uploadImage={uploadImage} />;
    return <MediaPlacementDrop id={id}><StandaloneImageActions id={id}>{imageEditor}</StandaloneImageActions></MediaPlacementDrop>;
  }
  const descriptionStyle = photographyLightboxStyle(typography);
  const openPreview = (trigger, editor) => {
    const items = zone.filter((block) => block.type === 'ImageBlock').map((block, itemIndex) => ({
      ...block.props,
      id: `gallery-${itemIndex}`,
      aspect: Number(block.props.cropAspect) || undefined,
      element: document.querySelector(`[data-photography-gallery-item][data-gallery-order="${itemIndex}"]`),
    }));
    openPhotographyLightbox({ items, startId: `gallery-${index}`, baseUrl: import.meta.env.BASE_URL, descriptionStyle, returnFocus: resolvePhotographyLightboxFocusTarget(editor, trigger), frameSelector: '.puck-image-viewport' });
  };
  return <div className="photography-gallery2-item" data-photography-gallery-item data-gallery-order={index} style={{ '--photo2-aspect': aspect }}>
    <PuckImageEditor id={id} src={src} alt={alt} hoverZoom={hoverZoom} cropAspect={cropAspect} cropScale={cropScale} cropPosition={cropPosition} caption={caption} captionSettings={captionSettings} linkLabel={linkLabel} photographyDescription={photographyDescription} showPhotographyDescription={lightboxEnabled} onPhotographyPreview={lightboxEnabled ? openPreview : undefined} onNaturalAspect={setNaturalAspect} showHoverZoom={false} uploadImage={uploadImage} />
  </div>;
}

function PhotographyGallery2Canvas({ uploadImage }) {
  const { dispatch } = usePuck();
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const addImages = async (event) => {
    const files = [...(event.currentTarget.files || [])];
    event.currentTarget.value = '';
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      const added = [];
      for (const file of files) {
        try {
          const src = await uploadImage?.(file);
          if (src) added.push({
            type: 'ImageBlock',
            props: {
              id: `ImageBlock-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
              src, alt: '', caption: '', cropScale: 1, cropPosition: 'center', __galleryImage: true,
            },
          });
        } catch {
          // Keep processing the remaining selected files.
        }
      }
      if (added.length) {
        dispatch({ type: 'setData', data: (previous) => {
          const zone = 'root:photographyGallery2Right';
          return {
            ...previous,
            zones: { ...(previous.zones || {}), [zone]: [...(previous.zones?.[zone] || []), ...added] },
          };
        } });
      }
      const failed = files.length - added.length;
      showEditorFeedback(failed ? `已添加 ${added.length} 张，${failed} 张失败` : `已添加 ${added.length} 张图片`);
    } finally {
      setUploading(false);
    }
  };
  return <div className="photography-gallery photography-gallery2-media puck-photography-gallery puck-photography-gallery--single-column" data-photography-gallery>
    <div className="photography-gallery-tools"><button type="button" className="photography-gallery-add" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? '正在添加…' : '＋ 添加图片'}</button><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" multiple aria-label="添加摄影图片" onChange={addImages} /></div>
    <DropZone zone="photographyGallery2Right" className="photography-gallery2-items" minEmptyHeight={72} />
  </div>;
}

function PuckImageCarouselEditor({ id, images = [], caption = '', captionSettings, uploadImage, extraActions, imageListPath = 'images', showComponentActions = true, showAddImages = true, onDeleteImage, uniformComposition = false, mobileBar }) {
  const viewport = useContext(CanvasViewportContext);
  const { appState, dispatch, getSelectorForId } = usePuck();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewImages, setPreviewImages] = useState(null);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const editorRef = useRef(null);
  const visibleImages = previewImages || images;
  const captionValue = mediaCaption({ caption, captionSettings });
  const current = visibleImages[currentIndex] || { src: '', alt: '', cropScale: 1, cropPosition: 'center' };
  useEffect(() => {
    if (currentIndex >= visibleImages.length && visibleImages.length) setCurrentIndex(visibleImages.length - 1);
    if (!visibleImages.length && currentIndex !== 0) setCurrentIndex(0);
  }, [visibleImages.length, currentIndex]);
  useEffect(() => {
    if (previewImages && previewImages.length === images.length && previewImages.every((image, index) => image.src === images[index]?.src)) setPreviewImages(null);
  }, [images, previewImages]);
  const updateImages = (nextImages) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => withPathValue(props, imageListPath, nextImages)) });
  // Carousel captions belong to the whole carousel (or the carousel item inside
  // a composition), never to one slide.
  const captionPath = imageListPath.replace(/\.images$/, '');
  const updateCaption = (patch) => {
    const next = captionPatch(patch, { caption, captionSettings });
    dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => captionPath
      ? withPathValue(props, captionPath, { ...(valueAtPath(props, captionPath) || {}), ...next })
      : { ...props, ...next }) });
  };
  const removeSlide = (index) => {
    const next = visibleImages.filter((_, slideIndex) => slideIndex !== index);
    setPreviewImages(next);
    updateImages(next);
    setCurrentIndex((current) => Math.max(0, Math.min(current - Number(index < current), next.length - 1)));
  };
  const moveSlide = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= visibleImages.length) return;
    const next = [...visibleImages];
    [next[index], next[target]] = [next[target], next[index]];
    setPreviewImages(next);
    updateImages(next);
    setCurrentIndex((current) => {
      if (current === index) return target;
      if (current === target) return index;
      return current;
    });
  };
  const addImages = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const firstAddedIndex = visibleImages.length;
    const staged = [...visibleImages];
    const sharedCropAspect = visibleImages.find((image) => Number(image.cropAspect) > 0)?.cropAspect;
    const previews = files.map((file) => ({
      src: URL.createObjectURL(file), alt: '', ...(sharedCropAspect ? { cropAspect: sharedCropAspect } : {}), cropScale: 1, cropPosition: 'center',
    }));
    staged.push(...previews);
    setPreviewImages(staged);
    setCurrentIndex(firstAddedIndex);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const uploadedPath = await uploadImage?.(files[index]);
        if (uploadedPath) staged[firstAddedIndex + index] = { ...staged[firstAddedIndex + index], src: uploadedPath };
        else staged.splice(firstAddedIndex + index, 1);
        setPreviewImages([...staged]);
      }
      updateImages(staged);
    } catch {
      const completedImages = staged.filter((image) => !image.src.startsWith('blob:'));
      setPreviewImages(completedImages);
      updateImages(completedImages);
      setCurrentIndex(Math.max(0, Math.min(firstAddedIndex, completedImages.length - 1)));
    } finally {
      previews.forEach((image) => URL.revokeObjectURL(image.src));
      event.target.value = '';
    }
  };
  const editSlide = (index, source, changes) => dispatch({
    type: 'setData',
    data: (previous) => updateBlockProps(previous, id, (props) => {
      const slides = valueAtPath(props, imageListPath) || [];
      if (slides[index]?.src !== source) return props;
      return withPathValue(props, imageListPath, slides.map((slide, slideIndex) => {
        if (slideIndex === index) return { ...slide, ...changes };
        return changes.cropAspect === undefined ? slide : { ...slide, cropAspect: changes.cropAspect };
      }));
    }),
  });
  const replaceSlide = async (event) => {
    const file = event.currentTarget.files?.[0];
    const target = replaceTargetRef.current;
    event.currentTarget.value = '';
    if (!file || !target) return;
    const src = await uploadImage?.(file);
    if (src) editSlide(target.index, target.source, { src, cropScale: 1, cropPosition: 'center' });
  };
  const deleteComponent = () => {
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
  };
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    const unregisterOverlays = [...editor.querySelectorAll('.puck-image-actions, .puck-image-carousel-empty-actions, .puck-carousel-thumbnails')]
      .map((overlay) => registerOverlayPortal(overlay, { disableDrag: true }))
      .filter(Boolean);
    const onAction = (event) => {
      const button = event.target.closest('[data-carousel-action]');
      if (!button || !editor.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.carouselAction;
      if (action === 'add') addInputRef.current?.click();
      const index = Number(button.dataset.index);
      if (action === 'select-slide') setCurrentIndex(index);
      if (action === 'move-up') moveSlide(index, -1);
      if (action === 'move-down') moveSlide(index, 1);
      if (action === 'remove-slide') removeSlide(index);
      if (action === 'crop-slide') {
        const slide = visibleImages[index];
        const thumbnail = button.parentElement.querySelector('img');
        openImageCropEditor({
          src: slide.src,
          aspect: visibleImages[0]?.cropAspect || (thumbnail.naturalWidth / thumbnail.naturalHeight) || 1,
          scale: slide.cropScale,
          position: slide.cropPosition,
          onConfirm: ({ aspect, scale, position }) => editSlide(index, slide.src, { cropAspect: aspect, cropScale: scale, cropPosition: position }),
        });
      }
      if (action === 'replace-slide') {
        replaceTargetRef.current = { index, source: visibleImages[index].src };
        replaceInputRef.current?.click();
      }
      if (showComponentActions && action === 'delete-component') deleteComponent();
    };
    editor.addEventListener('click', onAction, true);
    return () => {
      editor.removeEventListener('click', onAction, true);
      unregisterOverlays.forEach((unregister) => unregister());
    };
  }, [visibleImages, currentIndex, id, getSelectorForId, dispatch, showComponentActions]);
  const carouselBlock = findBlockById(appState.data, id);
  const carouselMobileBar = !mobileBar && showComponentActions && viewport === 'mobile' ? <MobileOverrideBar
    label="图片轮播"
    mobile={carouselBlock?.props?.mobile}
    supportsWidth
    supportsCrop={Boolean(current.src)}
    hasMobileCrop={hasMobileImageCrop(current)}
    onChangeMobile={(nextMobile) => dispatch({ type: 'setData', data: (prev) => updateBlockProps(prev, id, (props) => ({ ...props, mobile: nextMobile })) })}
    onOpenMobileCrop={current.src ? () => openImageCropEditor({
      src: current.src,
      aspect: Number(current.mobileCropAspect) || Number(visibleImages[0]?.cropAspect) || 1,
      scale: current.mobileCropScale ?? current.cropScale ?? 1,
      position: current.mobileCropPosition || current.cropPosition || 'center',
      onConfirm: ({ aspect, scale, position }) => dispatch({
        type: 'setData',
        data: (prev) => updateBlockProps(prev, id, (props) => {
          const slides = valueAtPath(props, imageListPath) || [];
          return withPathValue(props, imageListPath, slides.map((slide, slideIndex) => (
            slideIndex === currentIndex
              ? { ...slide, mobileCropAspect: aspect, mobileCropScale: scale, mobileCropPosition: position }
              : { ...slide, mobileCropAspect: aspect }
          )));
        }),
      }),
    }) : undefined}
    onResetMobileCrop={() => dispatch({
      type: 'setData',
      data: (prev) => updateBlockProps(prev, id, (props) => {
        const slides = valueAtPath(props, imageListPath) || [];
        return withPathValue(props, imageListPath, slides.map((slide) => ({
          ...slide,
          mobileCropAspect: undefined,
          mobileCropScale: undefined,
          mobileCropPosition: undefined,
        })));
      }),
    })}
  /> : mobileBar;
  return <section ref={editorRef} data-caption-position={captionValue ? captionValue.position : undefined} className="puck-image-carousel-editor">
    <CaptionText value={captionValue} position="top" />
    <PuckImageEditor id={id} src={current.src} alt={current.alt} label="图片轮播" iconName="ImageCarouselBlock" showImageAdjustments={false} showComponentActions={showComponentActions && visibleImages.length > 0} onDeleteImage={onDeleteImage} showEmptyAddButton={false} showCaption={false} showLink={false} uniformCropAspect={!uniformComposition} uniformComposition={uniformComposition} uploadImage={uploadImage} imageListPath={imageListPath} imageIndex={currentIndex} extraActions={<>{showComponentActions && <DisplayWidthAction id={id} />}{extraActions}{showAddImages && visibleImages.length > 0 && <button type="button" data-carousel-action="add" className="puck-image-action cover-image-action" aria-label="添加图片" title="添加图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}{visibleImages.length > 0 && <MediaCaptionAction caption={caption} captionSettings={captionSettings} onChange={updateCaption} />}</>} cropAspect={visibleImages[0]?.cropAspect} cropScale={current.cropScale} cropPosition={current.cropPosition} mobileCropAspect={current.mobileCropAspect} mobileCropScale={current.mobileCropScale} mobileCropPosition={current.mobileCropPosition} mobileBar={carouselMobileBar} />
    <CaptionText value={captionValue} position="bottom" />
    {viewport === 'desktop' && (visibleImages.length ? <aside className="puck-carousel-thumbnails" aria-label="轮播图片列表" onPointerDown={(event) => event.stopPropagation()}>
      {visibleImages.map((image, index) => <div className="puck-carousel-thumbnail-row" key={`${image.src}-${index}`}>
        <button type="button" data-carousel-action="select-slide" data-index={index} aria-label={`查看第 ${index + 1} 张轮播图片`} aria-pressed={index === currentIndex}>
          <img src={imageElementSrc(image.src)} alt="" />
        </button>
        <button type="button" data-carousel-action="crop-slide" data-index={index} aria-label={`裁切第 ${index + 1} 张图片`} title="裁切图片">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h14a2 2 0 0 1 2 2v12" /></svg>
        </button>
        <button type="button" data-carousel-action="replace-slide" data-index={index} aria-label={`更换第 ${index + 1} 张图片`} title="更换图片">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg>
        </button>
        <button type="button" data-carousel-action="move-up" data-index={index} aria-label={`上移第 ${index + 1} 张图片`} title="上移" disabled={index === 0}><AdminActionIcon name="up" /></button>
        <button type="button" data-carousel-action="move-down" data-index={index} aria-label={`下移第 ${index + 1} 张图片`} title="下移" disabled={index === visibleImages.length - 1}><AdminActionIcon name="down" /></button>
        <button type="button" data-carousel-action="remove-slide" data-index={index} aria-label={`删除第 ${index + 1} 张图片`} title="删除"><AdminActionIcon name="delete" /></button>
      </div>)}
    </aside> : <div className="puck-image-carousel-empty-actions" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      {showAddImages && <button type="button" data-carousel-action="add" className="puck-image-carousel-add" aria-label="添加图片" title="添加图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}
      {showComponentActions && <><button type="button" data-carousel-action="delete-component" aria-label="删除组件" title="删除组件"><AdminActionIcon name="delete" /></button></>}
    </div>)}
    <input ref={replaceInputRef} className="puck-visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" aria-label="更换轮播图片" onChange={replaceSlide} />
    <input ref={addInputRef} className="puck-visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" multiple aria-label="添加轮播图片" onChange={addImages} />
  </section>;
}

const placementTypes = ['ParagraphBlock', 'SubheadingBlock', 'NoteBlock', 'SpecificationsBlock', 'InternalLinkBlock', 'ExternalLinkBlock', 'QuoteBlock', 'ImageBlock', 'ImageCarouselBlock', 'LocalVideoBlock', 'VideoEmbedBlock', 'MediaCompositionBlock', 'WideMediaBlock', 'SourceCardBlock', 'FreeSizeGroupBlock', 'LayoutGroupBlock', 'ResearchGroupBlock'];

const blockTypeLabels = {
  ParagraphBlock: '正文段落',
  SubheadingBlock: '正文小标题',
  NoteBlock: '备注',
  SpecificationsBlock: '作品参数',
  InternalLinkBlock: '站内链接',
  ExternalLinkBlock: '站外链接',
  QuoteBlock: '引用',
  ImageBlock: '图片',
  ImageCarouselBlock: '图片轮播',
  LocalVideoBlock: '本地视频',
  VideoEmbedBlock: '在线视频',
  MediaCompositionBlock: '内容组',
  WideMediaBlock: '宽幅图片',
  SourceCardBlock: '免责声明',
  FreeSizeGroupBlock: '自由尺寸组',
  LayoutGroupBlock: '布局群组',
  ResearchGroupBlock: '文字群组',
};

function MediaPlacementDrop({ children, disabled = false, id, sizing = false }) {
  const viewport = useContext(CanvasViewportContext);
  const { appState, getSelectorForId, dispatch } = usePuck();
  const zone = id && getSelectorForId(id)?.zone;
  const block = id && findBlockById(appState.data, id);
  const media = ['ImageBlock', 'ImageCarouselBlock', 'SourceCardBlock', 'LocalVideoBlock', 'VideoEmbedBlock', 'LayoutGroupBlock', 'ResearchGroupBlock', 'MediaCompositionBlock', 'FreeSizeGroupBlock'].includes(block?.type);
  const isMobile = viewport === 'mobile';
  const width = !isMobile && block?.props.displayHeight ? undefined : (!isMobile ? block?.props.displayWidth : undefined);
  const mobileWrap = isMobile ? mobileWrapProps(block?.props?.mobile) : { active: false, hidden: false, attrs: {}, style: undefined };
  const dropShell = useRef(null);
  useLayoutEffect(() => {
    const shell = dropShell.current;
    if (!shell) return;
    const update = () => {
      const rect = shell.getBoundingClientRect();
      const zoom = rect.width / shell.offsetWidth || 1;
      const previewEl = shell.closest('.puck-work-preview');
      const rightLimit = previewEl?.getBoundingClientRect().right ?? window.innerWidth;
      const mediaEls = [...shell.querySelectorAll('img,video,.source-media-card')];
      const right = Math.min(rightLimit, Math.max(rect.right, ...mediaEls.map(item => item.getBoundingClientRect().right)));
      const value = `${Math.max(shell.offsetWidth, (right - rect.left) / zoom)}px`;
      if (shell.style.getPropertyValue('--placement-drop-width') !== value) shell.style.setProperty('--placement-drop-width', value);
    };
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    shell.addEventListener('load', update, true);
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); shell.removeEventListener('load', update, true); window.removeEventListener('resize', update); };
  }, [appState.data, viewport]);

  if (isMobile && id && mobileWrap.hidden) {
    return <MobileHiddenPlaceholder label={blockTypeLabels[block?.type] || '组件'} onRestore={() => dispatch({
      type: 'setData',
      data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, mobile: normalizeMobileOverride({ ...(props.mobile || {}), hidden: undefined }) })),
    })} />;
  }

  const mobileShellStyle = isMobile && mobileWrap.width !== undefined ? { '--mobile-display-width': `${mobileWrap.width}%` } : {};
  return <div ref={dropShell} className={`puck-media-drop-shell puck-canvas-action-host${isMobile && mobileWrap.active ? ' mobile-override-wrap' : ''}`} data-drop-below-only={disabled || undefined} data-display-width={width || undefined} data-media-indent={!isMobile && media ? '' : undefined} {...(isMobile ? mobileWrap.attrs : {})} style={{ ...displayWidthStyle(width), ...mobileShellStyle, ...(!isMobile && media ? { paddingLeft: blockIndentValue(block.props) } : {}) }}>
    {children}
    {!isMobile && <DropZone zone="placement" allow={placementTypes} className="puck-media-placement-dropzone" minEmptyHeight={24} />}
  </div>;
}


function StandaloneImageActions({ id, children }) {
  return React.cloneElement(children, { extraActions: <DisplayWidthAction id={id} /> });
}

function DisplayWidthAction({ id }) {
  const { getSelectorForId, appState } = usePuck();
  const block = findBlockById(appState.data, id);
  const zone = getSelectorForId(id)?.zone;
  return <>
    {block?.type === "ImageBlock" ? <CanvasPopoverAction label="显示模式" icon="size" fields={close => <ImageRowSettingsFields id={id} single rowMode={block.props.displayHeight ? "fixedHeight" : "fixedWidth"} rowHeight={block.props.displayHeight} displayWidth={block.props.displayWidth} onClose={close} />} /> : zone && (block?.type === 'SourceCardBlock' || (!zone.endsWith(':items') && !zone.endsWith(':side'))) && <LayoutNumberAction id={id} field="displayWidth" label="显示宽度" initial={100} min={10} max={100} unit="%" />}
    <MediaBlockIndentAction id={id} />
  </>;
}

function OverflowControls({ settings, alignment, onChange }) {
  const change = (key, value) => onChange({ ...settings, [key]: value });
  const numericSetting = (key, label, autoValue, autoLabel, unit, max, initial) => {
    const value = settings[key] ?? autoValue;
    const custom = typeof value === 'number';
    return <label className="canvas-field"><span>{label}</span>
      <select value={custom ? 'custom' : value} onChange={(event) => change(key, event.target.value === 'custom' ? initial : event.target.value)}>
        <option value={autoValue}>{autoLabel}</option>
        {key === 'gap' && <option value="media">12 px</option>}
        <option value="custom">自定义</option>
      </select>
      {custom && <input type="number" min="0" max={max} step="any" aria-label={`${label}（${unit}）`} defaultValue={value} onChange={(event) => {
        if (event.target.value && event.target.validity.valid) change(key, event.target.valueAsNumber);
      }} onBlur={(event) => { if (!event.target.value || !event.target.validity.valid) event.target.value = value; }} />}
    </label>;
  };
  return <details className="puck-overflow-settings" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
    <summary className="puck-image-action" aria-label="超宽内容设置" title="超宽内容设置"><AdminActionIcon name="settings" /></summary>
    <div className="puck-overflow-panel">
      <label className="canvas-field"><span>垂直对齐</span><select value={alignment} onChange={(event) => change('align', event.target.value)}>
        <option value="top">上对齐</option><option value="bottom">下对齐</option><option value="stretch">上下对齐</option>
      </select></label>
      {numericSetting('gap', '左右间距', 'default', '默认（设计说明间距）', 'px', undefined, 24)}
      {numericSetting('textWidth', '文字宽度', 'auto', '自动', '%', 100, 100)}
    </div>
  </details>;
}

function PuckMediaCompositionEditor({ id, columns: incomingColumns = [], items: legacyItems = [], overflowRight = false, overflowSettings = {}, mobile, typography, categories, uploadImage, uploadVideo }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { dispatch, getSelectorForId } = usePuck();
  const { groupRef: editorRef, editingChildren, mode, surface } = useCanvasGroupSelection(id);
  const columns = Array.isArray(incomingColumns) && incomingColumns.length ? incomingColumns : [{ items: legacyItems }];
  const singleItem = columns.reduce((count, column) => count + (column.items || []).length, 0) === 1;
  const mobileLayout = normalizeMobileOverride(mobile)?.layout;
  const updateGroupMobile = (nextMobile) => dispatch({
    type: 'setData',
    data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, mobile: nextMobile })),
  });
  const updateItemMobile = (columnIndex, itemIndex, nextMobile) => updateColumns((previous) => previous.map((column, c) => c === columnIndex ? {
    ...column,
    items: (column.items || []).map((entry, i) => i === itemIndex ? { ...entry, mobile: nextMobile } : entry),
  } : column));
  const updateColumns = (transform) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => {
    const currentColumns = Array.isArray(props.columns) && props.columns.length ? props.columns : [{ items: props.items || [] }];
    const columns = transform(currentColumns).filter((column) => (column.items || []).length > 0);
    const { overflowRight: _overflowRight, overflowSettings: _overflowSettings, ...rest } = props;
    return { ...rest, columns, ...(columns.length > 1 && props.overflowRight ? { overflowRight: true, ...(props.overflowSettings ? { overflowSettings: props.overflowSettings } : {}) } : {}) };
  }) });
  const moveItem = (columnIndex, itemIndex, offset) => updateColumns((previous) => {
    const next = previous.map((column) => ({ ...column, items: [...(column.items || [])] }));
    const target = itemIndex + offset;
    const stackItems = next[columnIndex]?.items || [];
    if (target < 0 || target >= stackItems.length) return previous;
    [stackItems[itemIndex], stackItems[target]] = [stackItems[target], stackItems[itemIndex]];
    return next;
  });
  const removeGroup = () => {
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
  };
  const removeItem = (columnIndex, itemIndexToRemove) => {
    const totalItems = columns.reduce((count, column) => count + (column.items || []).length, 0);
    if (totalItems <= 1) {
      removeGroup();
      return;
    }
    updateColumns((previous) => previous.map((column, index) => index === columnIndex ? { ...column, items: (column.items || []).filter((_, itemIndex) => itemIndex !== itemIndexToRemove) } : column));
  };
  const columnCountKey = Number(overflowRight) + ":" + columns.map((column) => (column.items || []).length).join(',');
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    // Puck's canvas interaction layer otherwise sits above these inline controls.
    // Register each control surface so pointer events reach its buttons reliably.
    const unregisterOverlays = [...editor.querySelectorAll('.puck-overflow-settings, .puck-grouped-text-editor, .puck-grouped-link-editor, .puck-grouped-spec-editor')]
      .map((overlay) => registerOverlayPortal(overlay, { disableDrag: true }))
      .filter(Boolean);
    return () => unregisterOverlays.forEach((unregister) => unregister());
  }, [columnCountKey]);
  const renderItem = (item, columnIndex, index, settings) => {
    const itemMobileWrap = isMobile ? mobileWrapProps(item.mobile) : { active: false, hidden: false, attrs: {}, style: undefined };
    if (isMobile && itemMobileWrap.hidden) {
      const label = item.kind === 'imageCarousel' ? '轮播图' : item.kind === 'content' ? '组内内容' : '组内图片';
      return <MobileHiddenPlaceholder key={`${item.kind || 'image'}-${columnIndex}-${index}`} label={label} onRestore={() => updateItemMobile(columnIndex, index, normalizeMobileOverride({ ...(item.mobile || {}), hidden: undefined }))} />;
    }
    const mobileImageCrop = item.kind === 'image' ? item.image : item.kind === 'imageCarousel' ? item.images?.[0] : null;
    const itemMobileBar = isMobile ? <MobileOverrideBar
      label={item.kind === 'imageCarousel' ? '轮播' : item.kind === 'content' ? '内容' : '图片'}
      mobile={item.mobile}
      supportsWidth={columns.length === 1}
      supportsCrop={item.kind === 'image' || item.kind === 'imageCarousel'}
      hasMobileCrop={hasMobileImageCrop(mobileImageCrop)}
      onChangeMobile={(nextMobile) => updateItemMobile(columnIndex, index, nextMobile)}
      onOpenMobileCrop={item.kind === 'image' && item.image?.src ? () => openImageCropEditor({
        src: item.image.src,
        aspect: Number(item.image.mobileCropAspect) || Number(item.image.cropAspect) || 1,
        scale: item.image.mobileCropScale ?? item.image.cropScale ?? 1,
        position: item.image.mobileCropPosition || item.image.cropPosition || 'center',
        onConfirm: ({ scale, position, aspect }) => updateColumns((prev) => prev.map((col, c) => c === columnIndex ? {
          ...col,
          items: (col.items || []).map((entry, i) => i === index ? { ...entry, image: { ...entry.image, mobileCropAspect: aspect, mobileCropScale: scale, mobileCropPosition: position } } : entry),
        } : col)),
      }) : undefined}
      onResetMobileCrop={() => updateColumns((prev) => prev.map((col, c) => c === columnIndex ? {
        ...col,
        items: (col.items || []).map((entry, i) => i === index && entry.image ? { ...entry, image: { ...entry.image, mobileCropAspect: undefined, mobileCropScale: undefined, mobileCropPosition: undefined } } : entry),
      } : col))}
    /> : null;
    return <div className={`puck-media-composition-editor-item puck-canvas-action-host${isMobile && itemMobileWrap.active ? ' mobile-override-wrap' : ''}`} {...(isMobile ? itemMobileWrap.attrs : {})} style={{ ...(item.kind === 'content' ? { '--text-block-indent': blockIndentValue(item.block) } : {}), ...(isMobile && itemMobileWrap.width !== undefined ? { '--mobile-display-width': `${itemMobileWrap.width}%` } : {}) }} data-grouped-text={item.kind === 'content' && ['paragraph', 'richText', 'note', 'quote', 'specifications', 'internalLink', 'externalLink'].includes(item.block?.kind) ? '' : undefined} key={`${item.kind || 'image'}-${columnIndex}-${index}`}>
    {item.kind === 'imageCarousel'
      ? <PuckImageCarouselEditor id={id} images={item.images || []} caption={item.caption} captionSettings={item.captionSettings} imageListPath={`columns.${columnIndex}.items.${index}.images`} showComponentActions={false} showAddImages onDeleteImage={() => removeItem(columnIndex, index)} uniformComposition={false} uploadImage={uploadImage} extraActions={settings} mobileBar={itemMobileBar} />
      : item.kind === 'content' ? <><GroupedContentEditor historyField={`group:${id}:${columnIndex}:${index}`} item={item.block} typography={typography} categories={categories} settingsAction={settings} onDelete={() => removeItem(columnIndex, index)} uploadImage={uploadImage} uploadVideo={uploadVideo} onUpdate={(block) => updateColumns((previous) => previous.map((column, c) => c === columnIndex ? { ...column, items: (column.items || []).map((entry, i) => i === index ? { kind: 'content', block, ...(entry.mobile ? { mobile: entry.mobile } : {}) } : entry) } : column))} />{itemMobileBar && <div className="puck-canvas-action-rail">{itemMobileBar}</div>}</>
      : <PuckImageEditor id={id} src={item.image?.src || ''} alt={item.image?.alt || ''} showComponentActions={false} onDeleteImage={() => removeItem(columnIndex, index)} showEmptyAddButton={!item.image?.src} hoverZoom={item.image?.hoverZoom} cropAspect={item.image?.cropAspect} cropScale={item.image?.cropScale} cropPosition={item.image?.cropPosition} mobileCropAspect={item.image?.mobileCropAspect} mobileCropScale={item.image?.mobileCropScale} mobileCropPosition={item.image?.mobileCropPosition} caption={item.image?.caption} captionSettings={item.image?.captionSettings} linkLabel={item.image?.linkLabel} uploadImage={uploadImage} imageListPath={`columns.${columnIndex}.items`} imageIndex={index} imageFieldKey="image" uniformComposition={false} extraActions={settings} mobileBar={itemMobileBar} />}
  </div>;
  };
  const isTextMediaColumn = (column) => (column.items || []).length > 0 && (column.items || []).every((item) => item.kind === 'content' && ['paragraph', 'richText', 'note', 'quote', 'specifications', 'internalLink', 'externalLink'].includes(item.block?.kind));
  const mediaColumnCount = Math.max(1, columns.filter((column) => !isTextMediaColumn(column)).length);
  const hasOverflowLayout = !isMobile && overflowRight && columns.filter((column) => (column.items || []).length > 0).length > 1;
  const equalHeight = isEqualHeightMediaRow(columns, hasOverflowLayout);
  const textLayout = getOverflowTextLayout(columns, hasOverflowLayout);
  const rowSettings = overflowRowSettings(overflowSettings, equalHeight || textLayout.stack);
  const overflowStart = textLayout.inlineColumns || 1;
  const stretchMedia = equalHeight && rowSettings.align === 'stretch';
  const lead = columns[0]?.items?.[0];
  const leadSource = lead?.image?.src || lead?.block?.src;
  useEffect(() => {
    const row = editorRef.current?.querySelector('[data-overflow-align]');
    if (!row) return undefined;
    const stopOverflow = bindOverflowRow(row);
    const stopMedia = stretchMedia || textLayout.stack ? bindMediaRow(row) : undefined;
    return () => { stopOverflow(); stopMedia?.(); };
  }, [hasOverflowLayout, stretchMedia, leadSource, columnCountKey, textLayout.stack, columns[1]?.items?.[0]?.image?.src]);
  useEffect(() => {
    const group = editorRef.current;
    const stack = group?.querySelector('.puck-media-stack-columns');
    if (!group || !stack || !hasOverflowLayout) return undefined;
    const updateActionOffset = () => group.style.setProperty('--puck-group-actions-left', `${stack.offsetWidth}px`);
    updateActionOffset();
    const observer = new ResizeObserver(updateActionOffset);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [hasOverflowLayout, columnCountKey, rowSettings.textWidth, rowSettings.gap]);
  return <section ref={editorRef} data-group-mode={singleItem ? 'children' : mode} className={`puck-research-group-editor puck-canvas-action-host puck-media-composition-editor${hasOverflowLayout ? ' is-overflow-right' : ''}`}>
    <div inert={!singleItem && !editingChildren} className={`puck-media-stack-columns${hasOverflowLayout ? ' is-overflow-right' : ''}`} data-mobile-layout={mobileLayout} data-equal-height-media-row={stretchMedia ? "" : undefined} data-overflow-align={hasOverflowLayout ? rowSettings.align : undefined} data-overflow-custom-width={rowSettings.textWidth === undefined ? undefined : ""} data-overflow-text-columns={textLayout.inlineColumns} data-overflow-video-stack={textLayout.stack ? "" : undefined} style={{ '--media-column-count': columns.length, '--mobile-media-column-count': mediaColumnCount, '--inline-media-columns': overflowStart, '--overflow-gap': rowSettings.gap, '--overflow-text-width': rowSettings.textWidth === undefined ? undefined : `calc(var(--overflow-available) * ${rowSettings.textWidth})` }}>
      {columns.map((column, columnIndex) => <section className="puck-media-stack-column" data-media-row-column data-text-column={isTextMediaColumn(column) ? '' : undefined} data-overflow-side={hasOverflowLayout && columnIndex >= overflowStart ? columnIndex === overflowStart ? "start" : "right" : undefined} key={`column-${columnIndex}`}>
        <div className="puck-media-stack-column-items">{(column.items || []).map((item, index) => {
          const settings = hasOverflowLayout && columnIndex === columns.length - 1 && index === 0
            ? <OverflowControls settings={overflowSettings} alignment={rowSettings.align} onChange={(nextSettings) => dispatch({
              type: 'setData',
              data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, overflowSettings: nextSettings })),
            })} /> : null;
          return renderItem(item, columnIndex, index, <>{singleItem && <MediaBlockIndentAction id={id} />}{settings}</>);
        })}</div>
      </section>)}
    </div>
    {!isMobile && <DropZone zone="placement" allow={placementTypes} className="puck-media-placement-dropzone puck-media-composition-placement" minEmptyHeight={34} />}
    {!singleItem && surface}
    {isMobile && !singleItem && !editingChildren && <div className="puck-canvas-action-rail"><MobileOverrideBar label="内容组" mobile={mobile} supportsLayout={columns.length > 1} supportsWidth onChangeMobile={updateGroupMobile} /></div>}
    {!isMobile && !singleItem && <CanvasActionRail>
      <CanvasGroupBadge />
      <MediaBlockIndentAction id={id} />
      <GroupOrderAction lists={[
        ...(columns.length > 1 ? [{ label: '列顺序', items: columns.map((column) => column.items[0] || {}),
          move: (index, delta) => updateColumns((current) => moveGroupItem(current, index, delta)) }] : []),
        ...columns.map((column, index) => ({ label: columns.length > 1 ? `第 ${index + 1} 列` : '', items: column.items || [],
          move: (item, delta) => moveItem(index, item, delta) })),
      ]} />
      <DeleteCanvasAction onDelete={removeGroup} label="删除群组" />
    </CanvasActionRail>}
  </section>;
}

function GroupedContentEditor(props) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { historyField, item, typography, categories, settingsAction, onDelete, onUpdate } = props;
  const canIndent = ['paragraph', 'richText', 'note', 'quote', 'specifications', 'internalLink', 'externalLink'].includes(item.kind);
  const indent = canIndent && <BlockIndentAction value={item.blockIndent} size={item.blockIndentSize} defaultSize={Number(typography[item.kind === 'richText' ? 'paragraph' : item.kind]?.fontSize) || 14} onApply={(blockIndent, blockIndentSize) => onUpdate({ ...item, blockIndent, blockIndentSize })} />;
  const actions = (edit) => isMobile ? null : <CanvasActionRail>{settingsAction}{edit}{indent}<DeleteCanvasAction onDelete={onDelete} label="删除组内内容" /></CanvasActionRail>;
  if (['internalLink', 'externalLink'].includes(item.kind)) {
    return <WorkLinkBlock historyField={historyField} item={item} categories={categories} style={previewTextStyle(typography[item.kind])}
      onChange={(patch) => onUpdate({ ...item, ...patch })}
      render={(text, edit) => <>{text}{actions(edit)}</>} />;
  }
  if (['paragraph', 'note', 'richText'].includes(item.kind)) {
    const preset = typography[item.kind === 'note' ? 'note' : 'paragraph'];
    const text = Array.isArray(item.text) ? item.text.map((value) => ({ text: value })) : item.text;
    return <><InlineParagraph historyField={historyField} text={text} className="detail-copy puck-grouped-paragraph" style={previewTextStyle(preset)}
      paragraphStyle={() => ({ marginBottom: `${preset?.paragraphSpacing ?? 12}px`, textIndent: `${preset?.textIndent ?? 0}px` })}
      onChange={(text) => onUpdate({ ...item, text })} />{actions()}</>;
  }
  if (item.kind === 'specifications') {
    return <><InlineSpecifications historyField={historyField} items={item.items} style={previewTextStyle(typography.specifications)} onChange={(items) => onUpdate({ ...item, items })} />{actions()}</>;
  }
  if (item.kind === 'quote') {
    return <><InlineParagraph historyField={historyField} text={item.quote} className="puck-detail-quote" onChange={(paragraphs) => onUpdate({ ...item, quote: paragraphs.join('\n\n') })} />{actions()}</>;
  }
  return <><GroupedOtherContent {...props} />{item.kind !== 'localVideo' && actions()}</>;
}

function GroupedOtherContent({ item = {}, settingsAction, mobileBar, onUpdate, onDelete, uploadImage, uploadVideo }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const update = (patch) => onUpdate?.({ ...item, ...patch });



  if (item.kind === 'localVideo') return <div className="puck-grouped-video" data-caption-position={mediaCaption(item) ? mediaCaption(item).position : undefined}>
    <CaptionText value={mediaCaption(item)} position="top" />
    <div className="puck-grouped-link-editor">
      <div className="puck-grouped-video-frame puck-canvas-action-host">
        {item.src ? <video controls={!isMobile} preload="metadata" src={`/${item.src}`} /> : <span>尚未添加视频</span>}
        {isMobile ? (mobileBar && <div className="puck-canvas-action-rail">{mobileBar}</div>) : <CanvasActionRail>{settingsAction}
          <button className="puck-image-action cover-image-action" type="button" disabled={uploading} aria-label={item.src ? '更换视频' : '上传视频'} title={item.src ? '更换视频' : '上传视频'} onClick={(event) => { event.stopPropagation(); fileRef.current?.click(); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3" /></svg>
          </button>
          <MediaCaptionAction caption={item.caption} captionSettings={item.captionSettings} onChange={(patch) => update(captionPatch(patch, item))} />
          <button className="puck-image-action cover-image-action" type="button" aria-label="删除视频" title="删除视频" onClick={(event) => { event.stopPropagation(); onDelete(); }}>
            <AdminActionIcon name="delete" />
          </button>
        </CanvasActionRail>}
      </div>
      <input ref={fileRef} className="puck-visually-hidden-file" type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const src = await uploadVideo?.(file); if (src) update({ src }); } finally { setUploading(false); event.target.value = ''; } }} />
    </div>
    <CaptionText value={mediaCaption(item)} position="bottom" />
  </div>;
  if (item.kind === 'videoEmbed') {
    const source = videoEmbedSource(item.url || '');
    return <div className="puck-grouped-video" data-caption-position={mediaCaption(item) ? mediaCaption(item).position : undefined}>
    <CaptionText value={mediaCaption(item)} position="top" />
    <div className="puck-grouped-video-frame puck-online-video-frame puck-canvas-action-host">
      {source ? <iframe src={source} title={item.caption || '作品视频'} loading="lazy" tabIndex={-1} aria-hidden="true" /> : <span>{item.url ? '链接无法识别' : '粘贴 YouTube 或 Bilibili 链接'}</span>}
      {!isMobile && <CanvasActionRail>
        <CanvasPopoverAction label="编辑在线视频" icon="edit" fields={<label className="canvas-field"><span>视频链接</span><input type="url" value={item.url || ''} onChange={(event) => update({ url: event.target.value })} /></label>} />
        <MediaCaptionAction caption={item.caption} captionSettings={item.captionSettings} onChange={(patch) => update(captionPatch(patch, item))} />
      </CanvasActionRail>}
    </div>
    <CaptionText value={mediaCaption(item)} position="bottom" />
    </div>;
  }
  if (item.kind === 'wideMedia') return <div className="puck-grouped-link-editor puck-grouped-wide-media-editor">
    <textarea aria-label="宽幅图片组文字" value={item.caption || ''} onChange={(event) => update({ caption: event.target.value })} placeholder="添加图片组文字" />
    {(item.items || []).map((entry, index) => <div className="puck-grouped-wide-media-row" key={`${entry.src}-${index}`}>
      {entry.src && <img src={`/${entry.src.replace(/^\//, '')}`} alt={entry.alt || ''} />}
      <input aria-label={`宽幅图片 ${index + 1} 路径`} value={entry.src || ''} onChange={(event) => update({ items: item.items.map((image, imageIndex) => imageIndex === index ? { ...image, src: event.target.value } : image) })} placeholder="图片路径" />
      <input aria-label={`宽幅图片 ${index + 1} 替代文字`} value={entry.alt || ''} onChange={(event) => update({ items: item.items.map((image, imageIndex) => imageIndex === index ? { ...image, alt: event.target.value } : image) })} placeholder="替代文字" />
      <button type="button" disabled={uploading} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.parentElement?.querySelector('input[type="file"]')?.click(); }}>{uploading ? '上传中…' : '上传/更换'}</button>
      <button type="button" aria-label={`删除宽幅图片 ${index + 1}`} onClick={() => update({ items: item.items.filter((_, imageIndex) => imageIndex !== index) })}><AdminActionIcon name="delete" /></button>
      <input className="puck-visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" aria-label={`上传宽幅图片 ${index + 1}`} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const src = await uploadImage?.(file); if (src) update({ items: item.items.map((image, imageIndex) => imageIndex === index ? { ...image, src } : image) }); } finally { setUploading(false); event.target.value = ''; } }} />
    </div>)}
    <button type="button" disabled={uploading} onClick={() => update({ items: [...(item.items || []), { src: '', alt: '' }] })}>＋ 添加图片</button>
  </div>;
  return <div className="puck-grouped-text-editor">无法编辑的内容类型</div>;
}

function PuckLocalVideoEditor({ id, src, caption, captionSettings, mobile, uploadVideo }) {
  const viewport = useContext(CanvasViewportContext);
  const { dispatch, getSelectorForId } = usePuck();
  const isMobile = viewport === 'mobile';
  return <GroupedOtherContent item={{ kind: 'localVideo', src, caption, captionSettings }} uploadVideo={uploadVideo} settingsAction={<DisplayWidthAction id={id} />} mobileBar={isMobile ? <MobileOverrideBar label="本地视频" mobile={mobile} supportsWidth onChangeMobile={(nextMobile) => dispatch({ type: 'setData', data: (prev) => updateBlockProps(prev, id, (props) => ({ ...props, mobile: nextMobile })) })} /> : null}
    onUpdate={({ src: nextSrc, caption: nextCaption, captionSettings: nextCaptionSettings }) => dispatch({
      type: 'setData', data: (previous) => updateBlockProps(previous, id,
        (props) => ({ ...props, src: nextSrc, caption: nextCaption, captionSettings: nextCaptionSettings })),
    })}
    onDelete={() => {
      const selector = getSelectorForId(id);
      if (selector) dispatch({ type: 'remove', ...selector });
    }} />;
}

function PuckVideoEmbedEditor({ id, url, caption, captionSettings, mobile }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { dispatch, getSelectorForId } = usePuck();
  const update = (patch) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, ...patch })) });
  const remove = () => {
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: 'remove', ...selector });
  };
  const captionValue = mediaCaption({ caption, captionSettings });
  const source = videoEmbedSource(url || '');
  return <MediaPlacementDrop id={id}><figure data-caption-position={captionValue ? captionValue.position : undefined} className="detail-video puck-online-video-editor puck-canvas-action-host">
    <CaptionText value={mediaCaption({ caption, captionSettings })} position="top" />
    <div className="puck-video-embed-preview">{source ? <iframe src={source} title={caption || '作品视频'} loading="lazy" tabIndex={-1} aria-hidden="true" /> : <span>{url ? '链接无法识别' : '粘贴 YouTube 或 Bilibili 链接'}</span>}</div>
    <CaptionText value={captionValue} position="bottom" />
    {isMobile ? <div className="puck-canvas-action-rail"><MobileOverrideBar label="在线视频" mobile={mobile} supportsWidth onChangeMobile={(nextMobile) => update({ mobile: nextMobile })} /></div> : <CanvasActionRail>
      <DisplayWidthAction id={id} />
      <MediaCaptionAction caption={caption} captionSettings={captionSettings} onChange={(patch) => update(captionPatch(patch, { caption, captionSettings }))} />
      <CanvasPopoverAction label="编辑在线视频" icon="edit" fields={<label className="canvas-field"><span>视频链接</span><input type="url" value={url || ''} onChange={(event) => update({ url: event.target.value })} /></label>} />
      <DeleteCanvasAction onDelete={remove} />
    </CanvasActionRail>}
  </figure></MediaPlacementDrop>;
}

function PuckDispatchBridge({ dispatchRef, historyDocument, historyRevision }) {
  const puck = usePuck();
  const puckRef = useRef(puck);
  puckRef.current = puck;
  const { dispatch } = puck;
  const revisionRef = useRef(historyRevision);
  useLayoutEffect(() => {
    if (revisionRef.current === historyRevision) return;
    revisionRef.current = historyRevision;
    if (historyDocument) dispatch({ type: 'setData', data: historyDocument, recordHistory: false });
  }, [dispatch, historyRevision, historyDocument]);
  useEffect(() => { dispatchRef.current = dispatch; return () => { dispatchRef.current = null; }; }, [dispatch, dispatchRef]);
  useEffect(() => {
    const clearOnBlank = (event) => {
      if (event.target.closest('[data-puck-component], .puck-content-drawer-item, [popover], button, input, select, textarea, [contenteditable="true"]')) return;
      dispatch({ type: 'setUi', ui: { itemSelector: null } });
    };
    document.addEventListener('pointerdown', clearOnBlank, true);
    return () => document.removeEventListener('pointerdown', clearOnBlank, true);
  }, [dispatch]);
  useEffect(() => {
    const isTextEntry = (target) => target instanceof Element
      && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
    const hasTextSelection = () => Boolean(window.getSelection()?.toString());
    const onCopy = (event) => {
      const target = event.target;
      if (isTextEntry(target) || hasTextSelection()) return;

      const { appState, getItemBySelector } = puckRef.current;
      const selector = appState.ui.itemSelector;
      if (!selector || !getItemBySelector(selector)) return;
      const clipboard = copyPuckComponent(appState.data, selector);
      if (!clipboard) return;
      setComponentClipboard(clipboard);
      event.clipboardData?.setData('text/plain', 'puck-component');
      event.preventDefault();
      showEditorFeedback('组件已复制');
    };
    const onPaste = (event) => {
      if (isTextEntry(event.target) || hasTextSelection()) return;

      const clipboard = getComponentClipboard();
      if (!clipboard) return;
      const { appState, dispatch: send } = puckRef.current;
      const template = appState.data?.root?.props?.template;
      const fallbackZone = template === 'splitDetail' ? 'root:right' : 'root';
      const result = pastePuckComponent(appState.data, appState.ui.itemSelector, clipboard, fallbackZone);
      if (!result) return;
      event.preventDefault();
      send({ type: 'setData', data: result.data });
      send({ type: 'setUi', ui: { itemSelector: result.selector } });
      showEditorFeedback('组件已粘贴');
    };
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('paste', onPaste, true);
    return () => {
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, []);
  return null;
}

const placementOptions = [
  ['below-new-group', 'Down (Independent)'],
  ['below-stack', 'Down (Group)'],
  ['right', 'Right (Group)'],

];
function placementOptionsFor({ data, targetId, destinationZone }, research) {
  const { append, side, canGroup, addSide } = getPlacementCapabilities(data, targetId, destinationZone);
  return [
    ...placementOptions.filter(([value]) => canGroup || value === 'below-new-group'),
    ...(append ? [['append', 'Add to Existing Group']] : []),
    ...(!research && (side || addSide) ? [['side', 'Add Right Content']] : []),
  ];
}

function PlacementIcon({ placement }) {
  const below = placement.startsWith('below');
  if (placement === 'append') return <svg viewBox="0 0 36 32" aria-hidden="true"><rect x="2" y="5" width="32" height="22" rx="2" /><path d="M18 10v12m-6-6h12" /></svg>;
  const overflow = placement === 'side';
  const grouped = placement !== 'below-new-group';
  return <svg viewBox="0 0 36 32" aria-hidden="true">
    {grouped && <rect className="puck-placement-icon-group" x="1.5" y={below ? 1.5 : 5.5} width="33" height={below ? 29 : 21} rx="2" />}
    <rect x={below ? 7 : 5} y={below ? 5 : 9} width={below ? 22 : overflow ? 15 : 11} height={below ? 8 : 14} rx="1" />
    <rect className="puck-placement-icon-new" x={below ? 7 : overflow ? 23 : 20} y={below ? 19 : 9}
      width={below ? 22 : overflow ? 8 : 11} height={below ? 8 : 14} rx="1" />
    {overflow && <path d="M21 2h12m-2-2 2 2-2 2" />}
  </svg>;
}

function useCanvasGroupSelection(id, { enterOnPointerDown = true } = {}) {
  const { appState, getSelectorForId, dispatch } = usePuck();
  const [editingChildren, setEditingChildren] = useState(false);
  const groupRef = useRef(null);
  const surfaceRef = useRef(null);
  const groupSelector = getSelectorForId(id);
  const selected = appState.ui.itemSelector;
  const groupSelected = Boolean(groupSelector && selected?.zone === groupSelector.zone && selected.index === groupSelector.index);
  const mode = editingChildren ? 'children' : groupSelected ? 'group' : 'idle';

  useEffect(() => {
    if (!enterOnPointerDown && !editingChildren) return registerOverlayPortal(surfaceRef.current, { disableDrag: true });
  }, [editingChildren, enterOnPointerDown]);

  useEffect(() => {
    if (mode === 'idle') return;
    const closeOutside = (event) => {
      if (groupRef.current?.contains(event.target) || groupRef.current?.querySelector(':popover-open') || event.target.closest?.('.puck-image-hover-settings, .puck-component-settings-menu, .puck-link-popover')) return;
      if (editingChildren) setEditingChildren(false);
      if (groupSelected) dispatch({ type: 'setUi', ui: { itemSelector: null } });
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('.puck-placement-dialog, .puck-link-popover:popover-open, .puck-image-hover-settings')) return;
      if (groupRef.current?.querySelector('[data-group-mode="group"], [data-group-mode="children"]')) return;
      event.preventDefault();
      if (editingChildren) {
        dispatch({ type: 'setUi', ui: { itemSelector: getSelectorForId(id) } });
        setEditingChildren(false);
        requestAnimationFrame(() => surfaceRef.current?.focus({ preventScroll: true }));
      } else {
        dispatch({ type: 'setUi', ui: { itemSelector: null } });
      }
    };
    document.addEventListener('click', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mode, editingChildren, groupSelected, dispatch, getSelectorForId, id]);

  const selectGroup = (event) => {
    event.stopPropagation();
    editChildren(event);
  };
  const editChildren = (event) => {
    event.stopPropagation();
    dispatch({ type: 'setUi', ui: { itemSelector: null } });
    setEditingChildren(true);
  };
  const surface = !editingChildren && <button ref={surfaceRef} className="puck-research-group-surface" type="button"
    aria-label="进入群组并编辑组内组件"
    onPointerDown={(event) => { event.stopPropagation(); if (enterOnPointerDown) { event.preventDefault(); editChildren(event); } }} onClick={selectGroup} />;
  return { groupRef, editingChildren, setEditingChildren, editChildren, mode, surface };
}

function moveGroupItem(items, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function groupItemLabel(item) {
  const value = item.props || item.block || item;
  const image = value.image || value.images?.[0];
  const path = image?.src || value.src;
  const text = Array.isArray(value.text) ? value.text[0]?.text || value.text[0] : value.text;
  return image?.alt || String(path || '').split('/').at(-1)
    || (typeof text === 'string' && text.slice(0, 32))
    || ({ LayoutGroupBlock: '布局群组', ImageBlock: '图片', LocalVideoBlock: '本地视频', VideoEmbedBlock: '在线视频', ImageCarouselBlock: '轮播', ParagraphBlock: '正文段落' })[item.type]
    || ({ image: '图片', imageCarousel: '轮播', localVideo: '视频', videoEmbed: '在线视频', component: '组内组件' })[item.kind] || '组件';
}

function GroupOrderAction({ lists }) {
  return <CanvasPopoverAction label="调整组内顺序" icon="order" fields={<div className="puck-group-order">
    {lists.map(({ label, items, move }, listIndex) => items.length > 0 && <section key={listIndex}>
      {label && <div className="puck-group-order-label">{label}</div>}
      <ol>{items.map((item, index) => {
        const name = groupItemLabel(item);
        return <li key={item.props?.id || item.id || index}>
          <span title={name}>{name}</span>
          <button type="button" className="puck-image-action" disabled={index === 0} onClick={() => { move(index, -1); showEditorFeedback('已调整组内顺序'); }} aria-label={`上移 ${name}`}><AdminActionIcon name="up" /></button>
          <button type="button" className="puck-image-action" disabled={index === items.length - 1} onClick={() => { move(index, 1); showEditorFeedback('已调整组内顺序'); }} aria-label={`下移 ${name}`}><AdminActionIcon name="down" /></button>
        </li>;
      })}</ol>
    </section>)}
  </div>} />;
}

function CanvasGroupBadge({ label = '群组' }) {
  return <span className="puck-research-group-icon" role="img" aria-label={label} title={label}>
    <AdminActionIcon name="group" />
  </span>;
}

function LayoutNumberAction(props) {
  return <CanvasPopoverAction label={props.label} icon={props.field === 'displayWidth' ? 'width' : 'spacing'} fields={close => <LayoutNumberFields {...props} max={props.field === "displayWidth" ? Math.max(props.max, 150) : props.max} close={close} />} />;
}

function LayoutNumberFields({ id, field, label, initial, min, max, unit, close }) {
  const { appState, dispatch } = usePuck();
  const props = findBlockById(appState.data, id)?.props;
  const value = props?.[field] ?? initial;
  const [selectedValue, setSelectedValue] = useState(Number(value));
  useEffect(() => setSelectedValue(Number(value)), [value]);
  const [sideAlignment, setSideAlignment] = useState(props?.sideMatchHeight ? 'equalHeight' : props?.sideAlign || 'top');
  const presets = field === 'displayWidth'
    ? [75, 100, 125].filter(value => value <= max).map(value => [value, `${value}%`])
    : field === 'sideGap' ? [[48, '默认48px'], [12, '等宽12px']] : [];
  return <form className="puck-layout-setting" onSubmit={(event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const next = Number(fields.get('value'));
    dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({
      ...props, [field]: next === initial ? undefined : next,
      ...(field === 'sideGap' ? { sideMatchHeight: sideAlignment === 'equalHeight' || undefined, sideAlign: sideAlignment === 'bottom' ? 'bottom' : undefined } : {}),
    })) });
    close();
  }}>
    {field === 'sideGap' && <label className="canvas-field"><span>垂直对齐</span>
      <select value={sideAlignment} onChange={(event) => setSideAlignment(event.target.value)}>
        <option value="top">上对齐</option><option value="bottom">下对齐</option><option value="equalHeight">等高</option>
      </select>
    </label>}
    <label className="canvas-field"><span>{label} ({unit})</span><input key={value} type="number" name="value" required min={min} max={max} defaultValue={value} onChange={(event) => setSelectedValue(event.target.valueAsNumber)} /></label>
    <div className="puck-layout-actions"><div className="puck-setting-presets">{presets.map(([percent, name]) =>
      <button key={percent} type="button" className={`puck-setting-preset${selectedValue === percent ? ' is-active' : ''}`} onClick={(event) => {
        const input = event.currentTarget.form.elements.namedItem('value');
        input.value = percent;
        setSelectedValue(percent);
      }}>{name}</button>
    )}</div><button className="button button-dark" type="submit">应用</button></div>
  </form>;
}

function ImageRowSettingsFields({ id, single = false, rowMode = 'fixedWidth', rowHeight = 200, displayWidth, onClose }) {
  const { appState, dispatch } = usePuck();
  // Read the selected block when the form opens, including after saving or undoing.
  const current = findBlockById(appState.data, id)?.props || {};
  const [mode, setMode] = useState(() => single
    ? current.displayHeight ? 'fixedHeight' : 'fixedWidth'
    : current.rowMode === 'fixedHeight' ? 'fixedHeight' : 'fixedWidth');
  const [height, setHeight] = useState(Number(single ? current.displayHeight : current.rowHeight) || 200);
  const [width, setWidth] = useState(Number(current.displayWidth) || 100);
  return <form className="puck-layout-setting" onSubmit={(event) => {
    event.preventDefault();
    dispatch({ type: 'setData', data: previous => updateBlockProps(previous, id, props => {
      // Remove the other mode's dimensions rather than leaving stale height fields.
      const { displayHeight, displayWidth, rowMode, rowHeight, ...rest } = props;
      if (single) return mode === 'fixedHeight'
        ? { ...rest, displayHeight: Number(height) }
        : { ...rest, displayWidth: Number(width) };
      return mode === 'fixedHeight'
        ? { ...rest, rowMode: 'fixedHeight', rowHeight: Number(height) }
        : { ...rest, rowMode: 'fixedWidth', displayWidth: Number(width) };
    }) });
    onClose?.();
  }}>
    <label className="canvas-field"><span>显示模式</span><select value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="fixedWidth">Mode A · Width</option><option value="fixedHeight">Mode B · Height</option>
    </select></label>
    {mode === 'fixedHeight'
      ? <label className="canvas-field"><span>Height（px）</span><input type="number" min="80" max="1200" step="1" value={height} onChange={(event) => setHeight(event.target.value)} required />
      </label>
      : <label className="canvas-field"><span>Width（%）</span><input type="number" min="10" max="200" step="1" value={width} onChange={(event) => setWidth(event.target.value)} required />
      </label>}
    <div className="puck-layout-actions">
      <div className="puck-setting-presets">{(mode === 'fixedHeight' ? [200, 256, 320] : [75, 100, 125]).map((value) => <button type="button" key={value} className={`puck-setting-preset${Number(mode === 'fixedHeight' ? height : width) === value ? ' is-active' : ''}`} onClick={() => mode === 'fixedHeight' ? setHeight(value) : setWidth(value)}>{mode === 'fixedHeight' ? `${value}px` : `${value}%`}</button>)}</div>
      <button type="submit" className="button button-dark">应用</button>
    </div>
  </form>;
}

function PuckLayoutGroup({ id, layout, sideGap, sideMatchHeight, sideAlign, rowMode, rowHeight, mobile }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { appState, getSelectorForId, dispatch } = usePuck();
  const { groupRef, editingChildren, mode, surface } = useCanvasGroupSelection(id);
  const side = layout === 'side';
  const zone = getSelectorForId(id)?.zone || '';
  const canSize = !side && !zone.endsWith(':items') && !zone.endsWith(':side');
  const rowItems = appState.data.zones?.[`${id}:items`] || [];
  const imageMediaRow = layout === 'row' && rowItems.length > 0 && rowItems.every((item) => ['ImageBlock', 'SourceCardBlock'].includes(item.type));
  const fixedHeightRow = imageMediaRow && rowMode === 'fixedHeight';
  const mobileLayout = normalizeMobileOverride(mobile)?.layout;
  const refreshLayout = () => {
    const preview = groupRef.current?.closest('.puck-work-preview');
    if (preview) updateLayoutGroups(preview);
  };
  useLayoutEffect(refreshLayout, [appState.data, viewport]);
  const ungroup = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dispatch({ type: 'setData', data: (previous) => ungroupLayout(previous, id) });
  };
  const remove = () => {
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
  };
  return <MediaPlacementDrop id={id} disabled={editingChildren}><section ref={groupRef}
    className="puck-research-group-editor puck-canvas-action-host" data-group-mode={mode} data-content-layout={layout} data-mobile-layout={mobileLayout} data-image-row-mode={fixedHeightRow ? 'fixedHeight' : undefined} data-image-row-height={fixedHeightRow ? (Number(rowHeight) || 200) : undefined} data-side-align={side ? sideAlign : undefined} data-side-match-height={side && sideMatchHeight || undefined} style={{ '--mobile-item-count': Math.max(1, rowItems.filter((item) => !item?.props?.mobile?.hidden).length), ...(side ? { "--layout-side-gap": `${sideGap ?? 48}px` } : fixedHeightRow ? { '--image-row-height': `${Number(rowHeight) || 200}px` } : {}) }}
    onLoadCapture={refreshLayout}>
    <div inert={!editingChildren}>
      <DropZone zone="items" className={layout ? 'layout-group-items' : 'puck-research-group-dropzone'}
        collisionAxis={layout && layout !== 'column' ? 'x' : 'y'}
        minEmptyHeight={30} />
    </div>
    {side && <div className="layout-side-items" inert={!editingChildren}>
      <DropZone zone="side" className="puck-side-dropzone" minEmptyHeight={30} />
    </div>}
    {surface}
    {isMobile ? (!editingChildren && <div className="puck-canvas-action-rail"><MobileOverrideBar label={{ column: '纵排群组', row: '横排群组', side: '右侧配套组' }[layout] || '群组'} mobile={mobile} supportsLayout={layout === 'row'} supportsWidth={!side} onChangeMobile={(nextMobile) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, mobile: nextMobile })) })} /></div>) : <CanvasActionRail>
      <MediaBlockIndentAction id={id} />
      <CanvasGroupBadge label={{ column: 'Down · 纵排', row: 'Right · 横排', side: '右侧配套内容' }[layout]} />
      <GroupOrderAction lists={(side ? [['items', '左侧'], ['side', '右侧']] : [['items', '']]).map(([slot, label]) => {
        const key = `${id}:${slot}`;
        return { label, items: appState.data.zones?.[key] || [], move: (index, delta) =>
          dispatch({ type: 'setData', data: (previous) => ({ ...previous, zones: {
            ...previous.zones, [key]: moveGroupItem(previous.zones?.[key] || [], index, delta),
          } }) }) };
      })} />
      {canSize && imageMediaRow
        ? <CanvasPopoverAction label="横向图片设置" icon="size" fields={(close) => <ImageRowSettingsFields id={id} rowMode={rowMode} rowHeight={rowHeight} displayWidth={findBlockById(appState.data, id)?.props?.displayWidth} onClose={close} />} />
        : canSize && <LayoutNumberAction id={id} field="displayWidth" label="显示宽度" initial={100} min={10} max={layout === 'row' && zone !== 'root:right' ? 200 : 100} unit="%" />}
      {side && <LayoutNumberAction id={id} field="sideGap" label="右侧间距" initial={48} min={0} max={120} unit="px" />}
      <button className="puck-image-action" type="button" aria-label="解散群组" title="解散群组" onClick={ungroup}>
        <AdminActionIcon name="ungroup" />
      </button>
      <DeleteCanvasAction onDelete={remove} label="删除群组" />
    </CanvasActionRail>}
  </section></MediaPlacementDrop>;
}

function PhotographyLightboxToggle() {
  const { appState, dispatch } = usePuck();
  const enabled = appState.data.root?.props?.photographyLightboxEnabled === true;
  return <div className="puck-work-heading-fields puck-work-heading-toggle"><label className="puck-photography-lightbox-field">
    <span>点击图片放大</span>
    <input name="photographyLightboxEnabled" type="checkbox" checked={enabled} onChange={(event) => dispatch({ type: 'setData', data: (previous) => ({
      ...previous,
      root: { ...previous.root, props: { ...previous.root?.props, photographyLightboxEnabled: event.target.checked } },
    }) })} />
  </label></div>;
}

function WorkHeadingFields({ urlSlug, research = false, photography = false }) {
  const { appState, dispatch } = usePuck();
  const { title, type, articleLanguage = 'ja', photographyIntroWidth = 45, template } = appState.data.root?.props || {};
  const photographyIntroActive = photography && template === 'photographyGallery';
  const [widthDraft, setWidthDraft] = useState(String(photographyIntroWidth));
  useEffect(() => setWidthDraft(String(photographyIntroWidth)), [photographyIntroWidth]);
  const update = (name, value) => {
    dispatch({ type: 'setData', data: (previous) => ({
      ...previous,
      root: { ...previous.root, props: { ...previous.root?.props, [name]: value } },
    }) });
  };

  return <div className="puck-work-heading-fields">
    <label><span>Name</span><input name="title" value={title || ''} onChange={(event) => update('title', event.target.value)} /></label>
    <label><span>Type</span><input name="type" value={type || ''} onChange={(event) => update('type', event.target.value)} /></label>
    <label><span>Slug</span><input key={urlSlug} data-work-url-slug defaultValue={urlSlug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="使用小写英文、数字和连字符" /></label>
    {photographyIntroActive && <label><span>UP/vw</span><input name="photographyIntroWidth" type="number" min="10" max="100" step="1" value={widthDraft} onChange={(event) => setWidthDraft(event.target.value)} onBlur={() => {
      const parsed = Number(widthDraft);
      const next = Math.min(100, Math.max(10, Number.isFinite(parsed) && parsed ? parsed : 45));
      setWidthDraft(String(next));
      if (next !== Number(photographyIntroWidth)) update('photographyIntroWidth', next);
    }} /></label>}
    {research && <label className="puck-article-language"><select name="articleLanguage" aria-label="Language" value={articleLanguage} onChange={(event) => update('articleLanguage', event.target.value)}><option value="ja">日文</option><option value="zh">中文</option></select><span>Language</span></label>}
  </div>;
}

function CanvasActionRail({ children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => registerOverlayPortal(ref.current, { disableDrag: true }) || undefined, []);
  const stop = (event) => event.stopPropagation();
  return <div ref={ref} className={`puck-canvas-action-rail ${className}`} onPointerDown={stop} onMouseDown={stop}><CanvasActionMenu disabled={className.includes('puck-free-size-controls')}>{children}</CanvasActionMenu></div>;
}

function DeleteCanvasAction({ onDelete, label = '删除组件' }) {
  return <button className="puck-image-action" type="button" aria-label={label} title={label} onClick={(event) => {
    event.stopPropagation();
    onDelete();
  }}><AdminActionIcon name="delete" /></button>;
}

function SourceCardPreview({ text, linkText, href, paragraphStyle, externalLinkStyle, className = '' }) {
  const link = useRef(null);
  const safeHref = validExternalUrl(href);
  const displayText = sourceCardDisplayText(linkText, safeHref);
  useEffect(() => link.current ? registerOverlayPortal(link.current, { disableDrag: true }) : undefined, [safeHref]);
  return <div className={`source-media-card ${className}`} style={{ aspectRatio: `${sourceCardAspect}` }}>
    <p className="detail-copy text-style-paragraph source-card-disclaimer" style={paragraphStyle}>{sourceCardText}</p>
    {displayText && <p className="detail-copy text-style-externalLink source-card-link-line" style={externalLinkStyle}>
      <span className="source-card-link-prompt">{sourceCardLinkPrompt}</span>{' '}{displayText && (safeHref
        ? <a ref={link} className="puck-preview-link" href={safeHref} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{displayText}</a>
        : <span>{displayText}</span>)}
    </p>}
  </div>;
}

function SourceCardFields({ text, linkText, href = '', onApply, onClose }) {
  const [error, setError] = useState('');
  return <form className="puck-free-media-form" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const rawHref = form.elements.cardHref.value.trim();
    const safeHref = validExternalUrl(rawHref);
    if (rawHref && !safeHref) { setError('请输入有效的 HTTPS 外链。'); return; }
    onApply({ text: sourceCardText, linkText: form.elements.cardLinkText.value, href: safeHref });
    onClose?.();
  }}>
    <label className="canvas-field"><span>出典链接显示文字</span><input name="cardLinkText" type="text" defaultValue={sourceCardDisplayText(linkText, href)} placeholder="MUJI壁挂式CD机-深泽直人" required /></label>
    <label className="canvas-field"><span>站外链接（HTTPS）</span><input name="cardHref" type="url" defaultValue={href} placeholder="https://" /></label>
    {error && <small role="alert">{error}</small>}
    <button type="submit" className="button button-dark">应用</button>
  </form>;
}

function PuckSourceCard({ id, text, linkText, href, caption, captionSettings, mobile, paragraphStyle, externalLinkStyle }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { dispatch, getSelectorForId } = usePuck();
  const update = (patch) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, ...patch })) });
  const captionValue = mediaCaption({ caption, captionSettings });
  return <div className="puck-canvas-action-host puck-source-card-editor" data-caption-position={captionValue ? captionValue.position : undefined}>
    <CaptionText value={captionValue} position="top" />
    <SourceCardPreview text={text} linkText={linkText} href={href} paragraphStyle={paragraphStyle} externalLinkStyle={externalLinkStyle} />
    <CaptionText value={captionValue} position="bottom" />
    {isMobile ? <div className="puck-canvas-action-rail"><MobileOverrideBar label="出处卡片" mobile={mobile} supportsWidth onChangeMobile={(nextMobile) => update({ mobile: nextMobile })} /></div> : <CanvasActionRail>
      <DisplayWidthAction id={id} />
      <MediaCaptionAction caption={caption} captionSettings={captionSettings} onChange={(patch) => update(captionPatch(patch, { caption, captionSettings }))} />
      <CanvasPopoverAction label="设置免责声明链接" icon="link" fields={(close) => <SourceCardFields text={text} linkText={linkText} href={href} onApply={update} onClose={close} />} />
      <DeleteCanvasAction onDelete={() => {
        const selector = getSelectorForId(id);
        if (selector) dispatch({ type: 'remove', ...selector });
      }} />
    </CanvasActionRail>}
  </div>;
}

function PuckFreeSizeGroup({ id, items = [], mode: initialMode = 'work', height = 320, overflowRight = false, mobile, uploadImage, uploadVideo, paragraphStyle, externalLinkStyle }) {
  const viewportMode = useContext(CanvasViewportContext);
  const isMobile = viewportMode === 'mobile';
  const effectiveOverflowRight = !isMobile && overflowRight;
  const mobileLayout = normalizeMobileOverride(mobile)?.layout;
  const { dispatch, getSelectorForId } = usePuck();
  const { groupRef, editingChildren, setEditingChildren, editChildren, mode: selectionMode, surface } = useCanvasGroupSelection(id, { enterOnPointerDown: false });
  const [selectedItemId, setSelectedItemId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const replaceImageRef = useRef(null);
  const replaceVideoRef = useRef(null);
  const replaceItemRef = useRef('');
  const itemId = (item, index) => item.id || `free-size-${id}-${index}`;
  const pickMedia = (event, item) => {
    event.stopPropagation();
    replaceItemRef.current = item.id;
    (item.kind === 'localVideo' ? replaceVideoRef : replaceImageRef).current?.click();
  };
  const updateProps = (patch) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, ...patch })) });
  const updateItems = (transform) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, items: transform(props.items || []) })) });
  const replaceMedia = async (event, kind) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const targetId = replaceItemRef.current;
    replaceItemRef.current = '';
    if (!file || !targetId) return;
    setUploading(true);
    setError('');
    try {
      const path = kind === 'video' ? await uploadVideo?.(file) : await uploadImage(file);
      if (path) updateItems((current) => current.map((item, itemIndex) => {
        if (itemId(item, itemIndex) !== targetId) return item;
        if (item.kind === 'localVideo') return { ...item, src: path };
        if (item.kind === 'imageCarousel') return { ...item, images: [{ ...item.images?.[0], src: path }, ...(item.images || []).slice(1)] };
        return { ...item, image: { ...(item.image || {}), src: path } };
      }));
      else setError('媒体上传失败，请重试。');
    } catch (reason) { setError(reason.message || '媒体替换失败。'); }
    finally { setUploading(false); }
  };
  const move = (index, offset) => updateItems((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.length) return current;
    const reordered = [...current];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  });
  const ensureIds = items.map((item, index) => ({ ...item, id: itemId(item, index) }));
  const selectedIndex = Math.max(0, ensureIds.findIndex((item) => item.id === selectedItemId));
  const selectedItem = editingChildren ? ensureIds[selectedIndex] : null;
  const removeSelectedItem = () => {
    if (ensureIds.length === 1) {
      const selector = getSelectorForId(id);
      if (selector) dispatch({ type: 'remove', ...selector });
      return;
    }
    const removedId = selectedItem.id;
    dispatch({ type: 'setData', data: (previous) => {
      const next = updateBlockProps(previous, id, (props) => ({
        ...props,
        items: (props.items || []).filter((item, index) => itemId(item, index) !== removedId),
      }));
      if (selectedItem.kind !== 'component') return next;
      const { [`${id}:${freeSizeItemZone(removedId)}`]: _removed, ...zones } = next.zones || {};
      return { ...next, zones };
    } });
    setSelectedItemId((ensureIds[selectedIndex + 1] || ensureIds[selectedIndex - 1])?.id || '');
  };
  useLayoutEffect(() => {
    const root = groupRef.current;
    const viewport = root?.querySelector('.puck-free-size-viewport');
    const track = root?.querySelector('.puck-free-size-track');
    if (!root || !viewport || !track) return undefined;
    const ratioOf = (element) => {
      const source = ensureIds.find((item) => item.id === element.dataset.itemId);
      if (source?.kind === 'component') return layoutItemRatio(element);
      if (source?.kind === 'sourceCard') return sourceCardAspect;
      if (source?.kind === 'videoEmbed' || source?.kind === 'localVideo') {
        const video = element.querySelector('video');
        return video?.videoWidth && video?.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      }
      const image = source?.kind === 'image' ? source.image : source?.images?.find((entry) => entry?.src);
      if (image?.cropAspect) return Number(image.cropAspect) || 1.5;
      const media = element.querySelector('img');
      return media?.naturalWidth && media?.naturalHeight ? media.naturalWidth / media.naturalHeight : 1.5;
    };
    const layout = () => {
      if (effectiveOverflowRight) {
        const frame = root.closest('#preview-frame');
        const zoom = root.getBoundingClientRect().width / root.offsetWidth || 1;
        const gutter = frame ? parseFloat(getComputedStyle(frame).paddingRight) : 0;
        const available = frame ? (frame.getBoundingClientRect().right - root.getBoundingClientRect().left) / zoom - gutter : 0;
        root.style.setProperty('--free-size-wide-width', `${Math.max(0, available)}px`);
      }
      const research = initialMode === 'research';
      const referenceHeight = Math.max(40, Number(height) || 320);
      for (const item of track.children) {
        if (!item.matches('.puck-free-size-item')) continue;
        const ratio = ratioOf(item);
        const hasCaption = item.hasAttribute('data-has-caption');
        item.style.setProperty('--free-item-ratio', ratio);
        item.style.width = research ? `${referenceHeight * ratio}px` : '';
        item.style.height = research && !hasCaption && !item.classList.contains('has-component') ? `${referenceHeight}px` : '';
        if (hasCaption) item.style.setProperty('--free-item-media-height', `${referenceHeight}px`);
      }
    };
    const positionRail = () => {
      const item = track.querySelector(':scope > [data-free-size-selected]');
      if (!item) return;
      const right = item.offsetLeft + item.offsetWidth - viewport.scrollLeft;
      root.style.setProperty('--free-size-actions-left', `${Math.min(viewport.clientWidth, Math.max(0, right))}px`);
      root.style.setProperty('--free-size-actions-top', `${item.offsetTop}px`);
    };
    const refresh = () => { layout(); positionRail(); };
    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(viewport);
    observer.observe(track);
    const frame = root.closest('#preview-frame');
    if (frame) observer.observe(frame);
    viewport.addEventListener('scroll', positionRail);
    const media = [...track.querySelectorAll('img,video')];
    media.forEach((element) => element.addEventListener(element.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', refresh));
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', positionRail);
      media.forEach((element) => element.removeEventListener(element.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', refresh));
    };
  }, [ensureIds, initialMode, height, effectiveOverflowRight, editingChildren, selectedItemId]);
  return <MediaPlacementDrop id={id} disabled={editingChildren}><div ref={groupRef} className="puck-research-group-editor puck-free-size-group-editor puck-canvas-action-host" data-group-mode={selectionMode} data-free-size-mode={initialMode} data-mobile-layout={mobileLayout} data-free-size-wide={effectiveOverflowRight || undefined}>
    {isMobile ? (!editingChildren && <div className="puck-canvas-action-rail"><MobileOverrideBar label="自由尺寸组" mobile={mobile} supportsLayout supportsWidth onChangeMobile={(nextMobile) => updateProps({ mobile: nextMobile })} /></div>) : <CanvasActionRail className={`puck-free-media-child-tools puck-free-size-controls${selectedItem ? " is-item-controls" : ""}`}>
      {!selectedItem && <MediaBlockIndentAction id={id} />}
      <button type="button" className="puck-image-action" aria-label={editingChildren ? '退出自由尺寸群组编辑' : '编辑自由尺寸群组'}
        title={editingChildren ? '结束组内编辑' : '编辑群组'} aria-expanded={editingChildren} onClick={(event) => {
          if (!editingChildren) return editChildren(event);
          event.stopPropagation();
          setEditingChildren(false);
        }}><AdminActionIcon name={editingChildren ? 'group' : 'edit'} /></button>
      <GroupOrderAction lists={[{ items: ensureIds, move }]} />
      {selectedItem ? <React.Fragment key={selectedItem.id}>
        {selectedItem.kind === 'image' && selectedItem.image?.src && <CanvasPopoverAction label="图片悬停效果" icon="zoomIn" fields={<ImageHoverSettings value={selectedItem.image.hoverZoom} onChange={(hoverZoom) => updateItems((current) => current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, image: { ...item.image, hoverZoom } } : item))} getFrame={() => [...(groupRef.current?.querySelectorAll('.puck-free-size-item') || [])].find((element) => element.dataset.itemId === selectedItem.id)} />} />}
        {selectedItem.kind === 'image' && <MediaCaptionAction caption={selectedItem.image?.caption} captionSettings={selectedItem.image?.captionSettings} onChange={(patch) => updateItems((current) => current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, image: { ...item.image, ...captionPatch(patch, item.image) } } : item))} />}
        {selectedItem.kind === 'image' && <ImageLinkAction linkLabel={selectedItem.image?.linkLabel} onChange={(patch) => updateItems((current) => current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, image: { ...item.image, ...patch } } : item))} />}
        {selectedItem.kind !== 'image' && selectedItem.kind !== 'component' && <MediaCaptionAction caption={selectedItem.caption} captionSettings={selectedItem.captionSettings} onChange={(patch) => updateItems((current) => current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, ...captionPatch(patch, item) } : item))} />}
        {selectedItem.kind === 'videoEmbed' && <CanvasPopoverAction label="编辑在线视频" icon="edit" fields={<label className="canvas-field"><span>视频链接</span><input type="url" value={selectedItem.url || ''} onChange={(event) => updateItems((current) => current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, url: event.target.value } : item))} /></label>} />}
        {selectedItem.kind === 'sourceCard' && <CanvasPopoverAction label="设置免责声明" icon="settings" fields={(close) =>
          <SourceCardFields text={selectedItem.text} linkText={selectedItem.linkText} href={selectedItem.href} onApply={(patch) => updateItems((current) =>
            current.map((item, index) => itemId(item, index) === selectedItem.id ? { ...item, ...patch } : item))} onClose={close} />
        } />}
        {['image', 'imageCarousel', 'localVideo'].includes(selectedItem.kind) &&
          <button type="button" className="puck-image-action" aria-label={selectedItem.kind === 'localVideo' ? '更换视频' : '更换图片'} title={selectedItem.kind === 'localVideo' ? '更换视频' : '更换图片'} disabled={uploading}
            onClick={(event) => pickMedia(event, selectedItem)}><AdminActionIcon name="replace" /></button>}
        <button type="button" className="puck-image-action" aria-label="向左移动" title="向左移动" disabled={selectedIndex === 0}
          onClick={() => move(selectedIndex, -1)}>←</button>
        <button type="button" className="puck-image-action" aria-label="向右移动" title="向右移动" disabled={selectedIndex === ensureIds.length - 1}
          onClick={() => move(selectedIndex, 1)}>→</button>
        <DeleteCanvasAction label="移除项目" onDelete={removeSelectedItem} />
      </React.Fragment> : <>
      <CanvasPopoverAction label="自由尺寸群组设置" icon="settings" fields={<div className="puck-free-media-form">
        <label className="canvas-field"><span>尺寸基准</span>
          <select value={initialMode} onChange={(event) => updateProps({ mode: event.target.value })}>
            <option value="work">以宽度为基准</option><option value="research">以高度为基准</option>
          </select>
        </label>
        {initialMode === 'research' && <label className="canvas-field"><span>组高（px）</span>
          <input type="number" min="40" max="3000" defaultValue={height} onChange={(event) => {
            if (event.target.value && event.target.validity.valid) updateProps({ height: event.target.valueAsNumber });
          }} onBlur={(event) => {
            if (!event.target.value || !event.target.validity.valid) event.target.value = height;
          }} />
        </label>}
        <button type="button" className="button" aria-pressed={overflowRight}
          onClick={() => updateProps({ overflowRight: !overflowRight })}>超宽度</button>
      </div>} />
      {!editingChildren && <DeleteCanvasAction onDelete={() => {
        const selector = getSelectorForId(id);
        if (selector) dispatch({ type: 'remove', ...selector });
      }} label="删除群组" />}
      </>}
    </CanvasActionRail>}
    {uploading && <small className="puck-free-size-status" role="status">正在上传…</small>}
    {error && <small className="puck-free-size-status" role="alert">{error}</small>}
      <input ref={replaceImageRef} className="puck-visually-hidden-file" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" aria-label="上传组内图片" disabled={uploading} onChange={(event) => replaceMedia(event, 'image')} />
      <input ref={replaceVideoRef} className="puck-visually-hidden-file" tabIndex={-1} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogv" aria-label="上传组内视频" disabled={uploading} onChange={(event) => replaceMedia(event, 'video')} />
    <div className="puck-free-size-viewport"><div className="puck-free-size-track" inert={isMobile && !editingChildren ? true : undefined}>
      {ensureIds.map((item, index) => {
        if (isMobile && item.mobile?.hidden) {
          return <MobileHiddenPlaceholder key={item.id} label={`组内项 ${index + 1}`} onRestore={() => updateItems((current) => current.map((entry, idx) => itemId(entry, idx) === item.id ? { ...entry, mobile: normalizeMobileOverride({ ...(entry.mobile || {}), hidden: undefined }) } : entry))} />;
        }
        const itemCaption = item.kind === 'component' ? null : mediaCaption(item.kind === 'image' ? item.image : item);
        return <div className={`puck-free-size-item puck-canvas-action-host${item.kind === 'component' ? ' has-component' : ''}`} data-item-id={item.id} data-free-size-selected={selectedItem?.id === item.id || undefined} data-has-caption={itemCaption ? '' : undefined} data-caption-position={itemCaption ? itemCaption.position : undefined} key={item.id}>
        {isMobile && editingChildren && <div className="puck-canvas-action-rail"><MobileOverrideBar label={`组内项 ${index + 1}`} mobile={item.mobile} onChangeMobile={(nextMobile) => updateItems((current) => current.map((entry, idx) => itemId(entry, idx) === item.id ? { ...entry, mobile: nextMobile } : entry))} /></div>}
        <CaptionText value={itemCaption} position="top" />
        {item.kind === 'component'
          ? <div className="puck-free-size-component" inert={selectedItem?.id !== item.id}>
            <DropZone zone={freeSizeItemZone(item.id)} disallow={placementTypes} minEmptyHeight={30} />
          </div>
          : item.kind === 'sourceCard'
          ? <SourceCardPreview text={item.text} linkText={item.linkText} href={editingChildren ? item.href : undefined} paragraphStyle={paragraphStyle} externalLinkStyle={externalLinkStyle} />
          : item.kind === 'image' ? (item.image?.src ? <img src={`/${item.image.src.replace(/^\/+/, '')}`} alt={item.image.alt || ''} />
            : <div className="puck-free-size-placeholder puck-free-size-image-slot">{!isMobile && <CanvasActionRail><button type="button" className="button" aria-label="选择本地图片" disabled={uploading} onClick={(event) => pickMedia(event, item)}>选择本地图片</button></CanvasActionRail>}</div>)
          : item.kind === 'imageCarousel' ? (item.images?.[0]?.src ? <img src={`/${item.images[0].src.replace(/^\/+/, '')}`} alt={item.images[0].alt || ''} /> : <div className="puck-free-size-placeholder">图片轮播</div>)
          : item.kind === 'localVideo' ? <video src={`/${(item.src || '').replace(/^\/+/, '')}`} controls={editingChildren} preload="metadata" />
          : <div className="puck-free-size-placeholder">{item.url || '在线视频'}</div>}
        <CaptionText value={itemCaption} position="bottom" />
        {editingChildren && selectedItem?.id !== item.id && <button type="button" className="puck-free-size-select-item"
          ref={(element) => element ? registerOverlayPortal(element, { disableDrag: true }) : undefined}
          aria-label={`选中组内组件 ${index + 1}`} onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); setSelectedItemId(item.id); }} />}
      </div>; })}
      {!ensureIds.length && <div className="puck-free-media-empty">从右侧拖入组件，选择 Add to Existing Group。</div>}
      {surface}
    </div></div>
  </div></MediaPlacementDrop>;
}

function TextPlacement({ id, children, editLink }) {
  const viewport = useContext(CanvasViewportContext);
  const isMobile = viewport === 'mobile';
  const { appState, getSelectorForId, dispatch } = usePuck();
  const block = findBlockById(appState.data, id);
  const indent = block?.props?.blockIndent ?? 0;
  const typography = useContext(IndentTypographyContext);
  const defaultSize = Number(typography[typographyTypeByComponent[block?.type]]?.fontSize) || 14;
  const mobileWrap = isMobile ? mobileWrapProps(block?.props?.mobile) : { active: false, hidden: false, attrs: {}, style: undefined };
  const applyIndent = (blockIndent, blockIndentSize) => dispatch({
    type: 'setData',
    data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, blockIndent, blockIndentSize })),
  });
  const remove = () => {
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: 'remove', index: selector.index, zone: selector.zone });
  };
  if (isMobile && id && mobileWrap.hidden) {
    return <MobileHiddenPlaceholder label={blockTypeLabels[block?.type] || '文字'} onRestore={() => dispatch({
      type: 'setData',
      data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, mobile: normalizeMobileOverride({ ...(props.mobile || {}), hidden: undefined }) })),
    })} />;
  }
  return <MediaPlacementDrop><div className={`puck-canvas-action-host${editLink ? ' puck-link-action-host' : ''}${isMobile && mobileWrap.active ? ' mobile-override-wrap' : ''}`} {...(isMobile ? mobileWrap.attrs : {})} style={{ '--text-block-indent': blockIndentValue(block?.props), ...(isMobile && mobileWrap.width !== undefined ? { '--mobile-display-width': `${mobileWrap.width}%` } : {}) }}>
    {children}
    {isMobile ? (id && <div className="puck-canvas-action-rail"><MobileOverrideBar label={blockTypeLabels[block?.type] || '文字'} mobile={block?.props?.mobile} supportsWidth onChangeMobile={(nextMobile) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, mobile: nextMobile })) })} /></div>) : <CanvasActionRail>{editLink}<BlockIndentAction value={indent} size={block?.props?.blockIndentSize} defaultSize={defaultSize} onApply={applyIndent} /><DeleteCanvasAction onDelete={remove} /></CanvasActionRail>}
  </div></MediaPlacementDrop>;
}

const IndentTypographyContext = createContext({});

function MediaBlockIndentAction({ id }) {
  const { appState, dispatch } = usePuck();
  const props = findBlockById(appState.data, id)?.props || {};
  return <BlockIndentAction value={props.blockIndent} size={props.blockIndentSize} onApply={(blockIndent, blockIndentSize) => dispatch({ type: 'setData', data: previous => updateBlockProps(previous, id, props => ({ ...props, blockIndent, blockIndentSize })) })} />;
}

function BlockIndentFields({ value = 0, size, defaultSize = 14, onApply, onClose }) {
  const [count, setCount] = useState(value);
  const [pixels, setPixels] = useState(size || defaultSize);
  return <form className="puck-indent-form" onSubmit={event => {
    event.preventDefault();
    event.stopPropagation();
    onApply(Number(count), Number(pixels));
    onClose();
  }}>
    <label className="canvas-field"><span>每字符宽度（px）</span><input name="characterSize" type="number" min="1" max="200" step="any" value={pixels} onChange={event => setPixels(event.target.value)} required /></label>
    <label className="canvas-field"><span>整体缩进（字符）</span><input name="indent" type="number" min="0" max="20" step="1" value={count} onChange={event => setCount(event.target.value)} required /></label>
    <div className="puck-layout-actions"><small>实际缩进：{Number((Number(count) * Number(pixels)).toFixed(2))}px</small><button className="button button-dark" type="submit">应用</button></div>
  </form>;
}

function BlockIndentAction(props) {
  return <CanvasPopoverAction label="整体缩进" icon="indent" fields={close => <BlockIndentFields {...props} onClose={close} />} />;
}

function CanvasPopoverAction({ label, icon, fields, wide = false, feedbackText }) {
  const applied = () => showEditorFeedback(feedbackText || `${label}已应用`);
  const menu = useContext(CanvasMenuContext);
  const accordionId = useId();
  const action = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!action.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (panel.current?.querySelector('.puck-image-hover-settings')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !panel.current || !position) return;
    const bounds = panel.current.getBoundingClientRect();
    const top = Math.max(12, Math.min(position.top, window.innerHeight - bounds.height - 12));
    if (top !== position.top) setPosition((current) => ({ ...current, top }));
  }, [open, position]);
  if (menu?.inline) {
    const expanded = menu.activeKey === accordionId;
    return <div className="puck-inline-setting">
      <button type="button" className="puck-image-action" aria-label={label} title={label} aria-expanded={expanded} aria-controls={accordionId} onClickCapture={event => {
        event.stopPropagation();
        menu.setActiveKey(expanded ? null : accordionId);
      }}><AdminActionIcon name={icon} /><span className="puck-setting-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      {expanded && <div id={accordionId} className="puck-inline-setting-fields">{typeof fields !== 'function' && <p className="admin-live-edit-note">修改即进入草稿</p>}{typeof fields === 'function' ? fields(() => { applied(); menu.setActiveKey(null); }) : fields}</div>}
    </div>;
  }
  return <div ref={action}>
      <button className="puck-image-action" type="button" aria-label={label} title={label} aria-expanded={open} onClick={(event) => {
      event.stopPropagation();
      if (open) return setOpen(false);
      const anchor = event.currentTarget.getBoundingClientRect();
      event.currentTarget.closest('.puck-component-settings-menu')?.hidePopover();
      const edge = 12;
      const canvas = document.querySelector('.puck-work-canvas')?.getBoundingClientRect();
      const toolsLeft = document.querySelector('#admin-tools')?.getBoundingClientRect().left ?? window.innerWidth;
      const canvasLeft = canvas?.left ?? 0;
      const rightEdge = Math.min(canvas?.right ?? window.innerWidth, toolsLeft);
      const rightSpace = rightEdge - anchor.right - edge;
      const leftSpace = anchor.left - canvasLeft - edge;
      const openRight = rightSpace >= Math.min(280, leftSpace) || rightSpace >= leftSpace;
      const available = openRight ? rightSpace : leftSpace;
      const narrow = window.innerWidth <= 620;
      const width = narrow ? Math.min(wide ? 300 : 280, window.innerWidth - edge * 2) : Math.max(120, Math.min(wide ? 300 : 280, window.innerWidth - edge * 2, available));
      setPosition({ left: narrow ? (window.innerWidth - width) / 2 : openRight ? anchor.right + 6 : Math.max(edge, anchor.left - width - 6), top: anchor.top, width });
      setOpen(true);
    }}><AdminActionIcon name={icon} /></button>
      {open && position && createPortal(<section ref={panel} className="puck-link-popover" role="dialog" aria-label={label}
        style={{ left: `clamp(12px, ${position.left}px, max(12px, calc(100vw - ${position.width}px - 12px)))`, top: position.top, width: position.width, maxWidth: 'calc(100vw - 24px)' }} onClick={(event) => event.stopPropagation()}>{typeof fields === 'function' ? fields(() => { applied(); setOpen(false); }) : fields}</section>, document.body)}
    </div>;
}

// One caption editor for every media component. The same fields, order and
// defaults must be used everywhere; only the storage location differs.
function captionPatch(patch, current = {}) {
  const caption = patch.caption !== undefined ? patch.caption : current.caption || '';
  const captionSettings = mediaCaptionSettings(patch.captionSettings !== undefined ? patch.captionSettings : current.captionSettings);
  return { caption, captionSettings };
}

function MediaCaptionFields({ caption = '', captionSettings, onApply, onClose }) {
  const settings = mediaCaptionSettings(captionSettings);
  const [draft, setDraft] = useState(() => ({ caption, position: settings.position, gap: settings.gap }));
  const setValue = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const gap = Number(draft.gap);
  const gapValid = draft.gap !== '' && Number.isFinite(gap) && gap >= mediaCaptionMinGap && gap <= mediaCaptionMaxGap;
  return <form className="puck-media-text-fields" onSubmit={(event) => {
    event.preventDefault();
    if (!gapValid) return;
    onApply(captionPatch({ caption: draft.caption, captionSettings: { position: draft.position, gap } }, { caption, captionSettings }));
    onClose?.();
  }}>
    <label className="canvas-field"><span>说明文字</span><textarea aria-label="说明文字" value={draft.caption} placeholder="留空则不显示说明" onChange={(event) => setValue({ caption: event.target.value })} /></label>
    <label className="canvas-field"><span>显示位置</span><select aria-label="说明显示位置" value={draft.position} onChange={(event) => setValue({ position: event.target.value })}><option value="bottom">媒体下方</option><option value="top">媒体上方</option></select></label>
    <label className="canvas-field"><span>与媒体的间距（px）</span><input type="number" min={mediaCaptionMinGap} max={mediaCaptionMaxGap} step="1" aria-label="说明与媒体的间距" aria-invalid={!gapValid} value={draft.gap} onChange={(event) => setValue({ gap: event.target.value })} /></label>
    <div className="puck-media-text-footer">
      <div className="puck-media-text-presets" role="group" aria-label="常用间距">
        {[4, 8, 12].map((value) => <button className="button" type="button" key={value} aria-pressed={gapValid && gap === value} onClick={() => setValue({ gap: value })}>{value}px</button>)}
      </div>
      <button type="submit" className="button button-dark" disabled={!gapValid}>应用</button>
    </div>
  </form>;
}

function MediaCaptionAction({ caption, captionSettings, onChange }) {
  return <CanvasPopoverAction label="文字说明" icon="caption" wide fields={(close) => <MediaCaptionFields caption={caption} captionSettings={captionSettings} onApply={onChange} onClose={close} />} />;
}

function PhotographyDescriptionFields({ description = '', onApply, onClose }) {
  const [draft, setDraft] = useState(description);
  return <form className="puck-media-text-fields" onSubmit={(event) => {
    event.preventDefault();
    onApply(draft);
    onClose?.();
  }}>
    <label className="canvas-field"><span>摄影说明</span><textarea aria-label="摄影说明" value={draft} placeholder="仅在放大查看时显示" onChange={(event) => setDraft(event.target.value)} /></label>
    <div className="puck-media-text-footer"><small>留空则不显示说明</small><button type="submit" className="button button-dark">应用</button></div>
  </form>;
}

const CaptionStyleContext = createContext({});

function CaptionText({ value, position }) {
  const preset = useContext(CaptionStyleContext);
  const { appState } = usePuck();
  const noteStyle = mediaCaptionStyle(preset, appState.data.root?.props?.articleLanguage);
  if (!value || value.position !== position) return null;
  return <p className="media-caption detail-copy text-style-note" style={{ ...noteStyle, ...(position === 'top' ? { marginBottom: value.gap } : { marginTop: value.gap }) }}>{value.text}</p>;
}

function ImageLinkFields({ linkLabel, onApply, onClose }) {
  const [error, setError] = useState('');
  const value = imageLinkLabel({ linkLabel }) || { text: '', href: '', newTab: true };
  return <form className="puck-media-text-fields" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = form.elements.linkText.value.trim();
    const rawHref = form.elements.linkHref.value.trim();
    const href = validExternalUrl(rawHref);
    if (!text && !rawHref) { onApply({ linkLabel: undefined }); onClose?.(); return; }
    if (!text) { setError('请填写链接文字。'); return; }
    if (!href) { setError('请输入有效的 HTTPS 外链。'); return; }
    onApply({ linkLabel: { text, href, newTab: form.elements.linkNewTab.value !== 'false' } });
    onClose?.();
  }}>
    <label className="canvas-field"><span>链接文字</span><input name="linkText" defaultValue={value.text} placeholder="显示在图片右下角" /></label>
    <label className="canvas-field"><span>链接地址（HTTPS）</span><input name="linkHref" type="url" defaultValue={value.href} placeholder="https://" /></label>
    <label className="canvas-field"><span>打开方式</span><select name="linkNewTab" defaultValue={String(value.newTab)}><option value="true">新标签打开</option><option value="false">当前标签打开</option></select></label>
    {error && <small className="puck-media-text-error" role="alert">{error}</small>}
    <div className="puck-media-text-footer"><button type="submit" className="button button-dark">应用</button></div>
  </form>;
}

function ImageLinkAction({ linkLabel, onChange }) {
  return <CanvasPopoverAction label="图片链接文字" icon="link" wide fields={(close) => <ImageLinkFields linkLabel={linkLabel} onApply={onChange} onClose={close} />} />;
}

const ExternalLinkStyleContext = createContext({});

function ImageLinkPreview({ linkLabel }) {
  const preset = useContext(ExternalLinkStyleContext);
  const label = imageLinkLabel({ linkLabel });
  return label ? <span className="image-link-label" style={mediaCaptionStyle(preset)} aria-hidden="true">{label.text}</span> : null;
}

function WorkLinkBlock({ historyField, item, categories, style, onChange, render }) {
  const internal = item.kind === 'internalLink';
  const category = categories.find((entry) => entry.slug === item.category);
  const pages = { '@home': '/', '@about': '/about/', '@contact': '/contact/' };
  const href = internal
    ? pages[item.category] || (category ? `/works/${category.slug}/${item.workSlug ? category.kind === 'research' ? '#research-' + item.workSlug : item.workSlug + '/' : ''}` : '#')
    : item.href || '#';
  const linkHref = internal && href !== '#' ? new URL(href, window.location.origin).href : href;
  const text = <p className={`detail-copy text-style-${item.kind}`} style={style}><a href={linkHref} draggable={false} className="puck-preview-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onAuxClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
    target={!internal && item.newTab !== false ? '_blank' : undefined}
    rel={!internal && item.newTab !== false ? 'noopener noreferrer' : undefined}>{item.text || '链接'} {internal ? '→' : '↗'}</a></p>;
  const edit = <CanvasPopoverAction label="编辑链接" icon="edit" fields={<>
    <label className="canvas-field"><span>显示文字</span><textarea data-history-field={`${historyField}:text`} value={item.text || ''} onChange={(event) => onChange({ text: event.target.value })} /></label>
    {internal ? <>
      <label className="canvas-field"><span>页面或作品分类</span><select value={item.category || ''} onChange={(event) => onChange({ category: event.target.value, workSlug: '' })}>
        <option value="">选择页面</option><option value="@home">首页</option><option value="@about">个人介绍</option><option value="@contact">联系方式</option>
        {categories.map(({ slug, title }) => <option key={slug} value={slug}>{title}</option>)}
      </select></label>
      {category && <label className="canvas-field"><span>具体作品 / 文章</span><select value={item.workSlug || ''} onChange={(event) => onChange({ workSlug: event.target.value })}>
        <option value="">打开分类页面</option>
        {(category.works || []).map(({ slug, title }) => <option key={slug} value={slug}>{title}</option>)}
      </select></label>}
    </> : <>
      <label className="canvas-field"><span>HTTPS 链接地址</span><input data-history-field={`${historyField}:href`} value={item.href || ''} onChange={(event) => onChange({ href: event.target.value })} /></label>
      <label><input type="checkbox" checked={item.newTab !== false} onChange={(event) => onChange({ newTab: event.target.checked })} /> 新标签打开</label>
    </>}
  </>} />;
  return render(text, edit);
}

function PuckLinkBlock({ id, item, categories, style }) {
  const { dispatch } = usePuck();
  return <WorkLinkBlock historyField={`link:${id}`} item={item} categories={categories} style={style}
    onChange={(patch) => dispatch({ type: 'setData', data: (previous) => updateBlockProps(previous, id, (props) => ({ ...props, ...patch })) })}
    render={(text, edit) => <TextPlacement id={id} editLink={edit}>{text}</TextPlacement>} />;
}

function createConfig(imagePaths, category = {}, isSplitDetail = false, isPhotographyGallery = false, onImageUpload, onVideoUpload, allCategories = [], typography = {}, isPhotographyGallery2 = false) {
  const imageOptions = selectOptions(imagePaths);
  const imageSelect = { type: 'select', options: imageOptions };
  const defaultTemplate = category.slug === 'photography' ? 'photographyGallery' : ['product', 'installation', 'visual'].includes(category.slug) ? 'splitDetail' : 'articleReading';
  const sourceCardParagraphStyle = previewTextStyle(typography.paragraph, 'ja', 'paragraph');
  const sourceCardExternalLinkStyle = { ...previewTextStyle(typography.externalLink), fontFamily: '"Noto Sans JP", "Yu Gothic", sans-serif' };
  return {
    categories: {
      text: { title: 'Add Text', components: ['ParagraphBlock', 'SubheadingBlock', ...(category.kind === 'research' ? [] : ['SpecificationsBlock']), 'InternalLinkBlock', 'ExternalLinkBlock', 'NoteBlock'], defaultExpanded: true },
      media: { title: 'Add Media', components: ['ImageBlock', 'ImageCarouselBlock', 'SourceCardBlock', 'LocalVideoBlock', 'VideoEmbedBlock'], defaultExpanded: true },
      other: { components: ['QuoteBlock', 'MediaCompositionBlock', 'WideMediaBlock'], visible: false },
    },
    root: {
      fields: {
        title: { type: 'text', contentEditable: true },
        type: { type: 'text' },
        ...(!isSplitDetail && !isPhotographyGallery ? { gallery: {
          type: 'array',
          label: category.slug === 'photography' ? '摄影图集图片' : '详情图片',
          arrayFields: {
            src: { ...imageSelect, label: '图片' },
            alt: { type: 'text', label: '替代文字' },
            caption: { type: 'text', label: '图片说明' },
          },
          defaultItemProps: { src: imagePaths[0] || '', alt: '', caption: '' },
          getItemSummary: (item, index) => `详情图 ${index + 1} · ${item.src?.split('/').at(-1) || '未选择图片'}`,
        } } : {}),
      },
      defaultProps: { title: '', type: '', image: '', imageScale: 1, imagePosition: 'center', template: defaultTemplate, seoTitle: '', seoDescription: '', photographyIntroWidth: 45, photographyLightboxEnabled: false, gallery: [] },
      render: ({ title, type, template = 'articleReading', gallery = [], photographyIntroWidth = 45, photographyLightboxEnabled = false, articleLanguage = 'ja', children }) => {
        const images = gallery.map((image, galleryIndex) => ({ ...image, galleryIndex })).filter((image) => image?.src);
        const imageStack = images.map((image, index) => {
          const caption = mediaCaption(image);
          const captionSettings = mediaCaptionSettings(image.captionSettings);
          return <div className="media-caption-unit" key={`${image.src}-${index}`} data-photography-gallery-item data-gallery-order={image.galleryIndex} data-caption-position={captionSettings.position} style={{ '--media-caption-gap': `${captionSettings.gap}px` }}>
            <figure className="detail-image" style={image.cropAspect ? { aspectRatio: `${image.cropAspect} / 1`, overflow: 'hidden' } : undefined}><img src={`/${image.src.replace(/^\//, '')}`} alt={image.alt || `作品详情图 ${index + 1}`} style={{ objectPosition: image.cropPosition || 'center', transform: `scale(${image.cropScale || 1})`, ...(image.cropAspect ? { height: '100%', maxHeight: 'none', objectFit: 'cover' } : {}) }} /></figure>
            {caption && <p className="media-caption detail-copy text-style-note" style={mediaCaptionStyle(typography.note, articleLanguage)}>{caption.text}</p>}
          </div>;
        });

        if (category.kind === 'research') return <article className="puck-research-preview" data-article-language={articleLanguage}><header><h1>{title}</h1><span aria-hidden="true">⌄</span></header>{children}</article>;

        if (template === 'splitDetail') return <article className="detail-page template-splitDetail"><div className="split-detail-layout"><div className="split-detail-left-column"><DropZone zone="left" className="split-detail-gallery puck-split-dropzone puck-split-left-zone" minEmptyHeight={56} /></div><aside className="split-detail-info"><header className="detail-heading"><h1>{title}</h1></header><section className="puck-split-extra-content" aria-label="右侧附加内容"><DropZone zone="right" className="puck-split-dropzone puck-split-right-zone" minEmptyHeight={18} /></section></aside></div></article>;

        if (template === 'photographyGallery') return <article className="detail-page template-photographyGallery">
          <section className="photography-intro-layout" style={{ '--photography-intro-width': `${Math.min(100, Math.max(10, Number(photographyIntroWidth) || 45))}vw` }}>
            <header className="detail-heading photography-heading"><h1>{title}</h1></header>
            <div className="photography-intro puck-detail-sections">{children}</div>
          </section>
          <PhotographyGalleryCanvas gallery={gallery} uploadImage={onImageUpload} lightboxEnabled={photographyLightboxEnabled} />
        </article>;

        if (template === 'photographyGallery2') return <article className="detail-page template-photographyGallery2">
          <div className="photography-gallery2-layout">
            <section className="photography-gallery2-text puck-detail-sections"><header className="detail-heading"><h1>{title}</h1></header>{children}</section>
            <PhotographyGallery2Canvas uploadImage={onImageUpload} />
          </div>
        </article>;

        return <article className="detail-page template-articleReading">
          <header className="detail-heading"><h1>{title}</h1></header>
          {images.length > 0 && <div className="article-detail-gallery puck-detail-gallery">{imageStack}</div>}
          <div className="puck-detail-sections">{children}</div>
        </article>;
      },
    },
    components: {
      ParagraphBlock: {
        label: '正文段落',
        fields: { text: { type: 'array', label: '段落', arrayFields: { text: { type: 'textarea', label: '文字' } }, defaultItemProps: { text: '' }, getItemSummary: (item) => (item.text || '').slice(0, 28) || '空段落' } },
        defaultProps: { text: textItems('在这里输入段落文字。') },
        render: ({ id, text = [] }) => <TextPlacement id={id}><PuckInlineTextBlock id={id} text={text} typographyVariant="paragraph" className="detail-copy text-style-paragraph" style={previewTextStyle(typography.paragraph)} paragraphStyle={() => ({ marginBottom: `${Number(typography.paragraph?.paragraphSpacing ?? 12)}px`, textIndent: `${Number(typography.paragraph?.textIndent ?? 0)}px` })} /></TextPlacement>,
      },
      SubheadingBlock: {
        label: '正文小标题',
        fields: { text: { type: 'textarea', label: '小标题文字' } },
        defaultProps: { text: '在这里输入正文小标题' },
        render: ({ id, text = '' }) => <TextPlacement id={id}><PuckInlineSubheadingBlock id={id} text={text} style={previewTextStyle(typography.subheading)} /></TextPlacement>,
      },
      NoteBlock: {
        label: '备注',
        fields: { text: { type: 'array', label: '段落', arrayFields: { text: { type: 'textarea', label: '文字' } }, defaultItemProps: { text: '' }, getItemSummary: (item) => (item.text || '').slice(0, 28) || '空段落' } },
        defaultProps: { text: textItems('在这里输入备注。') },
        render: ({ id, text = [] }) => <TextPlacement id={id}><PuckInlineTextBlock id={id} text={text} typographyVariant="note" className="detail-copy text-style-note" style={previewTextStyle(typography.note)} paragraphStyle={() => ({ marginBottom: `${Number(typography.note?.paragraphSpacing ?? 8)}px`, textIndent: `${Number(typography.note?.textIndent ?? 0)}px` })} /></TextPlacement>,
      },
      SpecificationsBlock: {
        label: '作品参数',
        fields: { items: { type: 'array', label: '参数行', arrayFields: { label: { type: 'text', label: '标题' }, value: { type: 'textarea', label: '内容' } }, defaultItemProps: { label: '新参数', value: '' }, getItemSummary: (item) => `${item.label || '未命名'}: ${(item.value || '').slice(0, 24)}` } },
        defaultProps: { items: [{ label: 'dimensions', value: '' }, { label: 'material', value: '' }, { label: 'date', value: '' }] },
        render: ({ id, items, dimensions = '', material = '', date = '' }) => <TextPlacement id={id}><PuckInlineSpecificationsBlock id={id} items={items} dimensions={dimensions} material={material} date={date} style={previewTextStyle(typography.specifications)} /></TextPlacement>,
      },
      InternalLinkBlock: {
        label: '站内超链接',
        fields: {
          text: { type: 'textarea', label: '显示文字' },
          category: { type: 'select', label: '页面或作品分类', options: [{ label: '选择页面', value: '' }, { label: '首页', value: '@home' }, { label: '个人介绍', value: '@about' }, { label: '联系方式', value: '@contact' }, ...allCategories.map((item) => ({ label: item.title, value: item.slug }))] },
          workSlug: { type: 'select', label: '具体作品 / 文章', options: [{ label: '打开分类页面', value: '' }] },
        },
        resolveFields: (data, params) => {
          const selectedCategory = allCategories.find((item) => item.slug === data.props?.category);
          const workSlug = { type: 'select', label: selectedCategory?.kind === 'research' ? '选择研究文章' : '具体作品（可选）', options: [{ label: '打开分类页面', value: '' }, ...(selectedCategory?.works || []).map((work) => ({ label: work.title, value: work.slug }))] };
          return { ...params.fields, workSlug };
        },
        defaultProps: { text: '相关内容', category: '', workSlug: '' },
        render: ({ id, text, category, workSlug }) => <PuckLinkBlock id={id} item={{ kind: 'internalLink', text, category, workSlug }} categories={allCategories} style={previewTextStyle(typography.internalLink)} />,
      },
      ExternalLinkBlock: {
        label: '站外超链接',
        fields: { text: { type: 'textarea', label: '显示文字' }, href: { type: 'text', label: 'HTTPS 链接地址' }, newTab: { type: 'radio', label: '打开方式', options: [{ label: '新标签打开', value: true }, { label: '当前标签打开', value: false }] } },
        defaultProps: { text: '外部链接', href: 'https://', newTab: true },
        render: ({ id, text, href, newTab }) => <PuckLinkBlock id={id} item={{ kind: 'externalLink', text, href, newTab }} categories={allCategories} style={previewTextStyle(typography.externalLink)} />,
      },
      ImageBlock: {
        label: '图片',
        fields: {},
        defaultProps: { src: '', alt: '', caption: '' },
        render: ({ id, src, alt, hoverZoom, cropAspect, cropScale, cropPosition, mobileCropAspect, mobileCropScale, mobileCropPosition, caption, captionSettings, linkLabel, photographyDescription }) => {
          if (isPhotographyGallery2) return <PhotographyGallery2ImageBlock id={id} src={src} alt={alt} hoverZoom={hoverZoom} cropAspect={cropAspect} cropScale={cropScale} cropPosition={cropPosition} caption={caption} captionSettings={captionSettings} linkLabel={linkLabel} photographyDescription={photographyDescription} uploadImage={onImageUpload} />;
          const imageEditor = <PuckImageEditor id={id} src={src} alt={alt} hoverZoom={hoverZoom} cropAspect={cropAspect} cropScale={cropScale} cropPosition={cropPosition} mobileCropAspect={mobileCropAspect} mobileCropScale={mobileCropScale} mobileCropPosition={mobileCropPosition} caption={caption} captionSettings={captionSettings} linkLabel={linkLabel} uploadImage={onImageUpload} />;
          return <MediaPlacementDrop id={id}><StandaloneImageActions id={id}>{imageEditor}</StandaloneImageActions></MediaPlacementDrop>;
        },
      },
      MediaCompositionBlock: {
        label: '内容组',
        fields: {},
        defaultProps: { columns: [{ items: [{ kind: 'image', image: { src: '', alt: '', cropScale: 1, cropPosition: 'center' } }] }] },
        render: ({ id, columns = [], items = [], overflowRight = false, overflowSettings, mobile }) => <MediaPlacementDrop id={id}><PuckMediaCompositionEditor id={id} columns={columns} items={items} overflowRight={overflowRight} overflowSettings={overflowSettings} mobile={mobile} typography={typography} categories={allCategories} uploadImage={onImageUpload} uploadVideo={onVideoUpload} /></MediaPlacementDrop>,
      },
      ImageCarouselBlock: {
        label: '图片轮播',
        fields: {},
        defaultProps: { images: [] },
        render: ({ id, images = [], caption, captionSettings }) => <MediaPlacementDrop id={id} sizing><PuckImageCarouselEditor id={id} images={images} caption={caption} captionSettings={captionSettings} uploadImage={onImageUpload} /></MediaPlacementDrop>,
      },
      SourceCardBlock: {
        label: '免责声明',
        fields: {},
        defaultProps: { text: sourceCardText, linkText: '', href: '' },
        render: ({ id, text, linkText, href, caption, captionSettings, mobile }) => <MediaPlacementDrop id={id}><PuckSourceCard id={id} text={text} linkText={linkText} href={href} caption={caption} captionSettings={captionSettings} mobile={mobile} paragraphStyle={sourceCardParagraphStyle} externalLinkStyle={sourceCardExternalLinkStyle} /></MediaPlacementDrop>,
      },
      FreeSizeGroupBlock: {
        label: 'Free Size Group',
        fields: {},
        defaultProps: { items: [], mode: category.kind === 'research' ? 'research' : 'work', anchorItemId: '', height: 320 },
        render: ({ id, items = [], mode = 'work', height = 320, overflowRight = false, mobile }) => <PuckFreeSizeGroup id={id} items={items} mode={mode} height={height} overflowRight={overflowRight} mobile={mobile} uploadImage={onImageUpload} uploadVideo={onVideoUpload} paragraphStyle={sourceCardParagraphStyle} externalLinkStyle={sourceCardExternalLinkStyle} />,
      },
      LocalVideoBlock: {
        label: '本地视频',
        fields: { caption: { type: 'text', label: '视频说明' } },
        defaultProps: { src: '', caption: '' },
        render: ({ id, src, caption, captionSettings, mobile }) => <MediaPlacementDrop id={id}><PuckLocalVideoEditor id={id} src={src} caption={caption} captionSettings={captionSettings} mobile={mobile} uploadVideo={onVideoUpload} /></MediaPlacementDrop>,
      },
      VideoEmbedBlock: {
        label: '在线视频链接',
        fields: { url: { type: 'text', label: 'YouTube / Bilibili 链接' }, caption: { type: 'text', label: '视频说明' } },
        defaultProps: { url: '', caption: '' },
        render: (props) => <PuckVideoEmbedEditor {...props} />,
      },
      WideMediaBlock: {
        label: '宽幅图片（旧内容）',
        fields: { caption: { type: 'textarea', label: '图片说明' } },
        defaultProps: { caption: '', items: [] },
        render: ({ caption, items = [] }) => <MediaPlacementDrop><div className="puck-wide-media-preview">{items.map((item, index) => item.src && <img key={`${item.src}-${index}`} src={`/${item.src.replace(/^\//, '')}`} alt={item.alt || ''} />)}{caption && <p>{caption}</p>}</div></MediaPlacementDrop>,
      },
      QuoteBlock: {
        label: '引用',
        fields: { quote: { type: 'textarea', label: '引用内容' } },
        defaultProps: { quote: '引用内容' },
        render: ({ id, quote }) => <TextPlacement id={id}><blockquote className="puck-detail-quote">{quote}</blockquote></TextPlacement>,
      },
      ResearchGroupBlock: {
        label: '群组',
        fields: {},
        defaultProps: {},
        render: ({ id, mobile }) => <PuckLayoutGroup id={id} mobile={mobile} />,
      },
      LayoutGroupBlock: {
        label: '布局群组',
        fields: {},
        defaultProps: { layout: 'column' },
        render: ({ id, layout, sideGap, sideMatchHeight, sideAlign, rowMode, rowHeight, mobile }) => <PuckLayoutGroup id={id} layout={layout} sideGap={sideGap} sideMatchHeight={sideMatchHeight} sideAlign={sideAlign} rowMode={rowMode} rowHeight={rowHeight} mobile={mobile} />,
      },
    },
  };
}

const workCanvasContentWidth = 1080;
const workCanvasGutter = 72;
const workCanvasWidth = workCanvasContentWidth + 2 * workCanvasGutter;
const clampCanvasZoom = (zoom) => Math.min(200, Math.max(10, zoom));

function WorkCanvas({ tools, canvasViewport = 'desktop', onViewportChange }) {
  const preventCanvasNavigation = (event) => {
    if (event.target.closest('a[href]')) event.preventDefault();
  };
  const isMobile = canvasViewport === 'mobile';
  const effectiveWidth = isMobile ? 390 : workCanvasWidth;
  const effectiveGutter = isMobile ? 20 : workCanvasGutter;
  const [zoom, setZoom] = useState(100);
  const viewportRef = useRef(null);
  useEffect(() => observeLayoutGroups(viewportRef.current), []);
  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return undefined;
    let frameId = 0;
    const run = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => alignMediaCaptionRows(root));
    };
    const preview = root.querySelector('#preview-frame');
    const resize = new ResizeObserver(run);
    if (preview) resize.observe(preview);
    const mutation = new MutationObserver(run);
    mutation.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-caption-position'] });
    run();
    return () => {
      cancelAnimationFrame(frameId);
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);
  const anchorRef = useRef(null);
  const changeZoom = (update) => {
    const viewport = viewportRef.current;
    const preview = viewport.querySelector('#preview-frame');
    if (!preview) return;
    const frame = preview.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    anchorRef.current = {
      x: (bounds.left + viewport.clientWidth / 2 - frame.left) / frame.width,
      y: (bounds.top + viewport.clientHeight / 2 - frame.top) / frame.height,
    };
    setZoom((current) => clampCanvasZoom(update(current)));
  };

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!anchor) return;
    const viewport = viewportRef.current;
    const preview = viewport.querySelector('#preview-frame');
    if (!preview) return;
    const frame = preview.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    viewport.scrollLeft += frame.left + frame.width * anchor.x - bounds.left - viewport.clientWidth / 2;
    viewport.scrollTop += frame.top + frame.height * anchor.y - bounds.top - viewport.clientHeight / 2;
  }, [zoom]);
  useEffect(() => {
    const viewport = viewportRef.current;
    let gestureStartZoom = null;
    const onWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (gestureStartZoom !== null) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      changeZoom((current) => current * Math.exp(-delta * 0.01));
    };
    const onGestureStart = (event) => {
      event.preventDefault();
      gestureStartZoom = Number(viewport.querySelector('.puck-work-sheet').style.getPropertyValue('--canvas-zoom')) * 100;
    };
    const onGestureChange = (event) => {
      if (gestureStartZoom === null || !Number.isFinite(event.scale)) return;
      event.preventDefault();
      changeZoom(() => gestureStartZoom * event.scale);
    };
    const onGestureEnd = (event) => {
      event.preventDefault();
      gestureStartZoom = null;
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('gesturestart', onGestureStart);
    viewport.addEventListener('gesturechange', onGestureChange);
    viewport.addEventListener('gestureend', onGestureEnd);
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('gesturestart', onGestureStart);
      viewport.removeEventListener('gesturechange', onGestureChange);
      viewport.removeEventListener('gestureend', onGestureEnd);
    };
  }, []);
  const fitWidth = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const style = getComputedStyle(viewport);
    const available = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    anchorRef.current = null;
    viewport.scrollLeft = 0;
    setZoom(Math.max(10, Math.min(100, Math.floor(available * 100 / effectiveWidth))));
  };

  useEffect(() => {
    fitWidth();
    if (viewportRef.current) requestAnimationFrame(() => updateLayoutGroups(viewportRef.current));
  }, [canvasViewport]);

  return <>
    <section className="puck-work-canvas">
    <div className="puck-work-preview" ref={viewportRef} onClickCapture={preventCanvasNavigation} onAuxClickCapture={preventCanvasNavigation} tabIndex={0} aria-label="作品画布，可滚动">
      <div className="puck-work-sheet" data-canvas-viewport={canvasViewport} style={{ '--canvas-width': `${effectiveWidth}px`, '--canvas-gutter': `${effectiveGutter}px`, '--canvas-zoom': zoom / 100 }}>
        <Puck.Preview />
      </div>
    </div>
    </section>
    {createPortal(<div className="puck-work-tools">{tools}</div>, document.getElementById('admin-tools'))}
    {createPortal(<div className="puck-canvas-toolbar" role="group" aria-label="画布缩放与视口">
      <div className="canvas-viewport-switch" role="group" aria-label="画板视口切换">
        <button type="button" aria-pressed={canvasViewport === 'desktop'} onClick={() => onViewportChange?.('desktop')}>桌面</button>
        <button type="button" aria-pressed={canvasViewport === 'mobile'} onClick={() => onViewportChange?.('mobile')}>手机</button>
      </div>
      <output className="canvas-zoom-value" aria-label="画布缩放比例">{Math.round(zoom)}%</output>
      <button type="button" className="admin-icon-button" aria-label="适应宽度" title="适应宽度" onClick={fitWidth}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14m16-14v14M7 12h10m-7-3-3 3 3 3m4-6 3 3-3 3"/></svg>
      </button>
    </div>, document.getElementById('canvas-toolbar'))}
  </>;
}

export function PuckWorkEditor({ historyDocument, historyRevision, category, categories, work, images, siteTypography, carouselSeconds, urlSlug, onChange, onThumbnailUpload, onGalleryUpload, onVideoUpload, onSaveTypography, onSaveCarouselSeconds }) {
  const [carouselAnchor, setCarouselAnchor] = useState(null);
  useEffect(() => {
    const className = 'puck-drawer-media-dragging';
    let clearTimer;
    const clear = () => {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        document.body.classList.remove(className);
        clearTimer = undefined;
      }, 250);
    };
    const onPress = (event) => {
      if (!event.target.closest?.('[data-puck-drawer="true"]')) return;
      window.clearTimeout(clearTimer);
      clearTimer = undefined;
      document.body.classList.add(className);
    };
    document.addEventListener('mousedown', onPress, true);
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('mouseup', clear, true);
    document.addEventListener('pointerup', clear, true);
    document.addEventListener('pointercancel', clear, true);
    document.addEventListener('dragend', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('mousedown', onPress, true);
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('mouseup', clear, true);
      document.removeEventListener('pointerup', clear, true);
      document.removeEventListener('pointercancel', clear, true);
      document.removeEventListener('dragend', clear, true);
      window.removeEventListener('blur', clear);
      window.clearTimeout(clearTimer);
      document.body.classList.remove(className);
    };
  }, []);
  useEffect(() => {
    if (!carouselAnchor) return;
    const close = () => setCarouselAnchor(null);
    const outside = (event) => {
      if (!event.target.closest('.puck-carousel-settings, [aria-label="设置图片轮播间隔"]')) close();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', close);
    };
  }, [carouselAnchor]);
  const [typographyTarget, setTypographyTarget] = useState('');
  const [placementDialog, setPlacementDialog] = useState(null);
  const [canvasViewport, setCanvasViewportState] = useState(readSavedCanvasViewport);
  const setCanvasViewport = useCallback((next) => {
    setCanvasViewportState(saveCanvasViewport(next));
  }, []);
  const [researchGroupMode, setResearchGroupMode] = useState(false);
  const [researchGroupIds, setResearchGroupIds] = useState([]);
  const [researchGroupMessage, setResearchGroupMessage] = useState('');
  const dispatchRef = useRef(null);
  const droppedFileInput = useRef(null);
  const pendingMedia = useRef(null);
  const openDroppedMedia = (block) => {
    if (!block || !['ImageBlock', 'LocalVideoBlock'].includes(block.type) || block.props.src) return;
    const input = droppedFileInput.current;
    if (!input) return;
    pendingMedia.current = block;
    input.accept = block.type === 'ImageBlock' ? 'image/jpeg,image/png,image/webp,image/gif,.gif' : 'video/*,.mov,.m4v,.ogv';
    input.click();
  };
  const uploadDroppedMedia = async (event) => {
    const file = event.currentTarget.files?.[0];
    const block = pendingMedia.current;
    pendingMedia.current = null;
    event.currentTarget.value = '';
    if (!block) return;
    if (!file) {
      dispatchRef.current?.({ type: 'setData', data: (previous) => removeEmptyBlockById(previous, block.props.id) });
      return;
    }
    const upload = block.type === 'ImageBlock' ? onGalleryUpload : onVideoUpload;
    try {
      const src = await upload?.(file);
      if (src) dispatchRef.current?.({ type: 'setData', data: (previous) =>
        updateBlockProps(previous, block.props.id, (props) => props.src ? props : { ...props, src }) });
    } catch {
      // The empty media component retains its manual upload control for retry.
    }
  };
  const cancelDroppedMedia = () => {
    const block = pendingMedia.current;
    pendingMedia.current = null;
    if (block) dispatchRef.current?.({ type: 'setData', data: (previous) => removeEmptyBlockById(previous, block.props.id) });
  };
  const puckDocument = useMemo(() => historyDocument ?? workToPuckDocument(work), [work.category, work.slug, work.title, work.type, work.date, work.description, work.dimensions, work.material, work.image, work.imageScale, work.imagePosition, work.masonryThumbnail, work.template, work.photographyIntroWidth, work.photographyLightboxEnabled, work.seoTitle, work.seoDescription, work.gallery, work.leftSections, work.sections, work.articleLanguage]);
  const photographyActive = ['photographyGallery', 'photographyGallery2'].includes(puckDocument?.root?.props?.template || work.template);
  useEffect(() => {
    if (!photographyActive || !researchGroupMode) return;
    setResearchGroupMode(false);
    setResearchGroupIds([]);
    setResearchGroupMessage('');
  }, [photographyActive, researchGroupMode]);
  const livePuckDocumentRef = useRef(puckDocument);
  useEffect(() => { livePuckDocumentRef.current = puckDocument; }, [puckDocument]);
  const handlePuckChange = useCallback((data, ...args) => {
    livePuckDocumentRef.current = data;
    onChange(data, ...args);
  }, [onChange]);
  const textGroupTypes = new Set([...Object.keys(typographyTypeByComponent), 'QuoteBlock']);
  const groupLists = (data) => [
    { zone: null, blocks: data.content || [] },
    ...['root:left', 'root:right'].map(zone => ({ zone, blocks: data.zones?.[zone] || [] })),
  ];
  const selectedGroupList = (data, id) => groupLists(data).find(({ blocks }) => blocks.some(block => block.props?.id === id));
  useEffect(() => {
    const viewport = document.querySelector('.puck-work-preview');
    if (!viewport) return;
    viewport.toggleAttribute('data-research-group-selection', researchGroupMode);
    viewport.querySelectorAll('[data-puck-component]').forEach((element) => {
      const id = element.getAttribute('data-puck-component');
      const list = selectedGroupList(puckDocument, id);
      const block = list?.blocks.find(block => block.props?.id === id);
      element.toggleAttribute('data-text-group-selectable', Boolean(block && textGroupTypes.has(block.type)));
      element.toggleAttribute('data-research-group-selected', researchGroupIds.includes(id));
    });
  }, [researchGroupMode, researchGroupIds, puckDocument]);
  const interceptResearchGroupPointer = (event) => {
    if (!researchGroupMode || event.target.closest('button,input,textarea,select,.puck-canvas-action-rail')) return;
    const component = event.target.closest('[data-puck-component]');
    if (!component) return;
    event.stopPropagation();
  };
  const selectResearchGroupComponent = (event) => {
    if (!researchGroupMode || event.target.closest('button,input,textarea,select,.puck-canvas-action-rail')) return;
    const component = event.target.closest('[data-puck-component]');
    if (!component) return;
    selectResearchGroupId(component.getAttribute('data-puck-component'), event);
  };
  const selectResearchGroupComponentByKeyboard = (event) => {
    if (!researchGroupMode || !['Enter', ' '].includes(event.key) || event.target.closest('button,input,textarea,select,.puck-canvas-action-rail')) return;
    const component = event.target.closest('[data-puck-component]');
    if (!component) return;
    selectResearchGroupId(component.getAttribute('data-puck-component'), event);
  };
  const selectResearchGroupId = (id, event) => {
    const list = selectedGroupList(livePuckDocumentRef.current, id);
    const blocks = list?.blocks || [];
    const index = blocks.findIndex((block) => block.props?.id === id);
    event.preventDefault();
    event.stopPropagation();
    if (index < 0) {
      setResearchGroupMessage('请从群组外选择文字组件；群组内的组件不能再次群组。');
      return;
    }
    if (!textGroupTypes.has(blocks[index].type)) {
      setResearchGroupMessage('只能选择文字组件，不能选择媒体或已有群组。');
      return;
    }
    if (researchGroupIds.length && selectedGroupList(livePuckDocumentRef.current, researchGroupIds[0])?.zone !== list.zone) {
      setResearchGroupMessage('请选择同一区域内连续的文字组件。');
      return;
    }
    const selectedIndexes = researchGroupIds.map((selectedId) => blocks.findIndex((block) => block.props?.id === selectedId)).filter((value) => value >= 0);
    if (researchGroupIds.includes(id)) {
      const min = Math.min(...selectedIndexes);
      const max = Math.max(...selectedIndexes);
      if (index !== min && index !== max) {
        setResearchGroupMessage('只能取消连续选择范围的首尾组件。');
        return;
      }
      setResearchGroupIds((current) => current.filter((selectedId) => selectedId !== id));
      setResearchGroupMessage('');
      return;
    }
    if (selectedIndexes.length) {
      const min = Math.min(...selectedIndexes);
      const max = Math.max(...selectedIndexes);
      if (index !== min - 1 && index !== max + 1) {
        setResearchGroupMessage('请只选择连续排列的组件。');
        return;
      }
    }
    setResearchGroupIds((current) => [...current, id]);
    setResearchGroupMessage('');
  };
  const cancelResearchGroupSelection = () => {
    setResearchGroupMode(false);
    setResearchGroupIds([]);
    setResearchGroupMessage('');
  };
  const groupResearchSelection = () => {
    const data = livePuckDocumentRef.current;
    const list = selectedGroupList(data, researchGroupIds[0]);
    const blocks = list?.blocks || [];
    const selectedIndexes = researchGroupIds.map((id) => blocks.findIndex((block) => block.props?.id === id)).sort((a, b) => a - b);
    if (selectedIndexes.length < 2 || selectedIndexes.some((index, itemIndex) => index < 0 || (itemIndex > 0 && index !== selectedIndexes[itemIndex - 1] + 1))) {
      setResearchGroupMessage('请先选择至少两个连续文字组件。');
      return;
    }
    if (selectedIndexes.some((index) => !textGroupTypes.has(blocks[index]?.type))) {
      setResearchGroupMessage('只能选择文字组件。');
      return;
    }
    const start = selectedIndexes[0];
    const end = selectedIndexes.at(-1);
    const id = `ResearchGroupBlock-content-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const items = blocks.slice(start, end + 1);
    const childZone = `${id}:items`;
    const grouped = [...blocks.slice(0, start), { type: 'ResearchGroupBlock', props: { id } }, ...blocks.slice(end + 1)];
    dispatchRef.current?.({ type: 'setData', data: {
      ...data,
      ...(list.zone === null ? { content: grouped } : {}),
      zones: { ...(data.zones || {}), ...(list.zone ? { [list.zone]: grouped } : {}), [childZone]: items },
    } });
    cancelResearchGroupSelection();
  };
  const imagePaths = images || [];
  const uploadCallbacks = useRef({ image: onGalleryUpload, video: onVideoUpload });
  uploadCallbacks.current = { image: onGalleryUpload, video: onVideoUpload };
  const configSignature = JSON.stringify([imagePaths, category?.slug, category?.kind, work.template,
    (categories || []).map(({ slug, title, kind, works }) => ({ slug, title, kind, works: (works || []).map(({ slug, title }) => ({ slug, title })) })), siteTypography]);
  const config = useMemo(() => createConfig(imagePaths, category, work.template === 'splitDetail', ['photographyGallery', 'photographyGallery2'].includes(work.template),
    (file) => uploadCallbacks.current.image?.(file), (file) => uploadCallbacks.current.video?.(file), categories || [], siteTypography || {}, work.template === 'photographyGallery2'), [configSignature]);
  const onPuckAction = (action, appState, prevAppState) => {
    if (canvasViewport === 'mobile' && ['insert', 'move', 'remove'].includes(action.type)) {
      window.requestAnimationFrame(() => dispatchRef.current?.({ type: 'setData', data: prevAppState.data, recordHistory: false }));
      return;
    }
    const rootContent = prevAppState.data.content || [];
    const rootIndex = action.destinationIndex;
    const adjacentGroups = Number.isInteger(rootIndex) ? [rootContent[rootIndex - 1], rootContent[rootIndex]] : [];
    const hoveredGroupTarget = action.type === 'insert' && action.destinationZone === 'root:default-zone'
      ? [...document.querySelectorAll('.puck-work-preview .puck-media-placement-dropzone[class*="DropZone--hoveringOverArea_"]')]
        .map((zone) => zone.getAttribute('data-puck-dropzone'))
        .filter((zone) => zone?.endsWith(':placement'))
        .map((zone) => findBlockById(prevAppState.data, zone.slice(0, -':placement'.length)))
        .find((block) => ['LayoutGroupBlock', 'ResearchGroupBlock'].includes(block?.type))
      : null;
    const rootGroupTarget = action.type === 'insert' && action.destinationZone === 'root:default-zone'
      && placementTypes.includes(action.componentType)
      ? hoveredGroupTarget || adjacentGroups.find((block) => ['LayoutGroupBlock', 'ResearchGroupBlock'].includes(block?.type)) : null;
    const rootGroupPlacement = Boolean(rootGroupTarget);
    const placement = ['insert', 'move'].includes(action.type)
      && (action.destinationZone?.endsWith(':placement') || rootGroupPlacement);
    if (!placement && appState.data !== prevAppState.data && !['registerZone', 'unregisterZone'].includes(action.type)) handlePuckChange(action.type === 'remove' ? pruneEmptyGroups(appState.data, action.zone) : appState.data);
    if (action.type === 'remove') {
      const next = pruneEmptyGroups(appState.data, action.zone);
      if (next !== appState.data) queueMicrotask(() => dispatchRef.current?.({
        type: 'setData', data: (previous) => pruneEmptyGroups(previous, action.zone), recordHistory: false,
      }));
      return;
    }
    if (!['insert', 'move'].includes(action.type) || typeof action.destinationZone !== 'string') return;
    if (rootGroupPlacement) {
      const targetId = rootGroupTarget.props.id;
      const destinationZone = `${targetId}:placement`;
      const incoming = findBlockById(appState.data, action.id);
      if (!incoming) return;
      const data = { ...prevAppState.data, zones: { ...prevAppState.data.zones, [destinationZone]: [incoming] } };
      window.requestAnimationFrame(() => {
        dispatchRef.current?.({ type: 'setData', data: prevAppState.data, recordHistory: false });
        setPlacementDialog({ targetId, destinationZone, data, insertedId: action.id });
      });
      return;
    }
    if (!action.destinationZone.endsWith(':placement')) {
      if (action.type === 'insert') openDroppedMedia(findBlockById(appState.data, action.id));
      return;
    }
    const targetId = action.destinationZone.slice(0, -':placement'.length);
    const data = appState.data;
    const target = findBlockById(data, targetId);
    const incoming = data.zones?.[action.destinationZone] || [];
    if (!target || !incoming.length) return;
    window.requestAnimationFrame(() => {
      dispatchRef.current?.({ type: 'setData', data: prevAppState.data, recordHistory: false });
      setPlacementDialog({ targetId, destinationZone: action.destinationZone, data, insertedId: action.type === 'insert' ? action.id : null });
    });
  };
  const closePlacementDialog = () => setPlacementDialog(null);
  const chooseMediaPlacement = (placement) => {
    if (!placementDialog) return;
    const nextData = applyMediaPlacement(placementDialog.data, placementDialog.targetId, placementDialog.destinationZone, placement);
    if (nextData) {
      dispatchRef.current?.({ type: 'setData', data: nextData });
      if (placementDialog.insertedId) openDroppedMedia(findBlockById(nextData, placementDialog.insertedId));
    }
    closePlacementDialog();
  };
  useEffect(() => {
    if (!placementDialog) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') closePlacementDialog(); };
    window.document.addEventListener('keydown', closeOnEscape);
    return () => window.document.removeEventListener('keydown', closeOnEscape);
  }, [placementDialog]);
  const renderDrawerItem = ({ name, children }) => {
      const styleType = typographyTypeByComponent[name];
      return <><div className="puck-content-drawer-item"><span className="puck-content-drawer-icon"><ContentTypeIcon name={name} /></span>{children}{name === 'ImageCarouselBlock' && <button type="button" className="puck-content-style-button" aria-label="设置图片轮播间隔" title="设置图片轮播间隔" aria-expanded={Boolean(carouselAnchor)} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const row = event.currentTarget.closest('.puck-content-drawer-item').getBoundingClientRect(); setCarouselAnchor(current => current ? null : { right: window.innerWidth - row.left + 8, top: Math.max(8, Math.min(row.top, window.innerHeight - 80)) }); }}><AdminActionIcon name="settings" /></button>}{styleType && <button type="button" className="puck-content-style-button" aria-label={`设置${typographyLabelByType[styleType]}样式`} title={`设置${typographyLabelByType[styleType]}样式`} aria-expanded={typographyTarget === styleType} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setTypographyTarget((current) => current === styleType ? '' : styleType); }}><AdminActionIcon name="settings" /></button>}</div>
      </>;
    };
  return <>
    <input ref={droppedFileInput} hidden type="file" onChange={uploadDroppedMedia} onCancel={cancelDroppedMedia} />
    <CanvasViewportContext.Provider value={canvasViewport}><IndentTypographyContext.Provider value={siteTypography || {}}><ExternalLinkStyleContext.Provider value={siteTypography?.externalLink || {}}><CaptionStyleContext.Provider value={siteTypography?.note || {}}><Puck overrides={compactPuckOverrides} config={config} data={puckDocument} onAction={onPuckAction} permissions={{ duplicate: false, delete: false }} iframe={{ enabled: false }}>
    <PuckDispatchBridge dispatchRef={dispatchRef} historyDocument={historyDocument} historyRevision={historyRevision} />
    <div className="puck-admin-work">
      <div className="puck-work-editor-layout">
      <div className={`puck-work-composition${researchGroupMode && !photographyActive ? ' is-research-group-selecting' : ''}`} onPointerDownCapture={interceptResearchGroupPointer} onClickCapture={selectResearchGroupComponent} onKeyDownCapture={selectResearchGroupComponentByKeyboard}>
          <WorkCanvas canvasViewport={canvasViewport} onViewportChange={(next) => { setCanvasViewport(next); if (next === 'mobile' && researchGroupMode) cancelResearchGroupSelection(); }} tools={<>
          <div className="puck-work-heading"><span>{category?.title || ''} · WORK</span><WorkHeadingFields urlSlug={urlSlug} research={category?.kind === 'research'} photography={photographyActive} /><div className="puck-work-heading-controls">
        {category?.kind !== 'research' && canvasViewport === 'desktop' && <TemplateControl />}
        {canvasViewport === 'desktop' && <div className="puck-work-heading-category-controls"><div className="category-move-control"><label className="canvas-field"><span>作品列表</span><select key={category?.slug} aria-label="选择作品列表" data-move-category defaultValue={category?.slug}>{(categories || []).map((item) => <option value={item.slug} key={item.slug}>{item.title}</option>)}</select></label><button className="canvas-add" type="button" data-action="move-work">Move</button></div>
          {photographyActive && <PhotographyLightboxToggle />}
        </div>}
      </div></div>
            {canvasViewport === 'mobile' ? <section className="puck-mobile-mode-banner" aria-label="手机画板模式">
              <h3>手机画板模式（≤720px）</h3>
              <p>以桌面端为基准源，当前仅修改手机端差异（隐藏、横排保留/2列/横滑、宽度与裁切）。</p>
              <p>增删组件或修改文字请切回桌面画板。</p>
              <button type="button" className="button button-dark" onClick={() => setCanvasViewport('desktop')}>切回桌面画板</button>
            </section> : <>
            {!photographyActive && <section className={`puck-research-group-toolbar${researchGroupMode ? ' is-active' : ''}`} aria-label="群组编辑">
              <button type="button" aria-pressed={researchGroupMode} onClick={() => {
                if (researchGroupMode) cancelResearchGroupSelection();
                else setResearchGroupMode(true);
              }}>{researchGroupMode ? '退出选择' : '选择文字组件'}</button>
              {researchGroupMode && <>
                <span className="puck-research-group-count">已选 {researchGroupIds.length}</span>
                <button type="button" disabled={researchGroupIds.length < 2} onClick={groupResearchSelection}>群组</button>
                <button type="button" onClick={cancelResearchGroupSelection}>取消</button>
                {researchGroupMessage && <p role="status">{researchGroupMessage}</p>}
              </>}
            </section>}
            <section className="puck-drawer-groups">{Object.entries(config.categories).filter(([, group]) => group.visible !== false).map(([id, group]) => <section key={id}>
              <h3>{group.title}</h3>
              <Drawer droppableId={`work-drawer-${id}`}>{group.components.map((name) => <Drawer.Item key={name} name={name} label={config.components[name].label}>{renderDrawerItem}</Drawer.Item>)}</Drawer>
            </section>)}</section>
            {category?.kind !== 'research' && <ThumbnailEditor category={category} onUpload={onThumbnailUpload} />}
            </>}
          </>} />
        </div>
      </div>
    </div>
    </Puck></CaptionStyleContext.Provider></ExternalLinkStyleContext.Provider></IndentTypographyContext.Provider></CanvasViewportContext.Provider>
    {carouselAnchor && createPortal(<PuckCarouselSettingsPanel seconds={carouselSeconds} anchor={carouselAnchor} onClose={() => setCarouselAnchor(null)} onConfirm={onSaveCarouselSeconds} />, document.body)}
    {typographyTarget && <PuckTextStylePanel key={typographyTarget} type={typographyTarget} style={{ ...typographyDefaults, ...(siteTypography?.[typographyTarget] || {}) }} fontFamilyDisabled={category?.kind === 'research' && ['paragraph', 'subheading', 'note'].includes(typographyTarget)} onClose={() => setTypographyTarget('')} onConfirm={onSaveTypography} />}
    {placementDialog && <div className="puck-placement-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePlacementDialog(); }}>
    <section className="puck-placement-dialog" role="dialog" aria-modal="true" aria-labelledby="puck-placement-title">
        <h3 id="puck-placement-title">Placement</h3>
        <div className="puck-placement-options">
          {placementOptionsFor(placementDialog, category?.kind === 'research').map(([value, title], index) => <button type="button" key={value}
            autoFocus={index === 0} onClick={() => chooseMediaPlacement(value)}>
            <PlacementIcon placement={value} />
            <span><strong>{title}</strong></span>
          </button>)}
        </div>
        <button className="puck-placement-cancel" type="button" onClick={closePlacementDialog}>Cancel</button>
      </section>
    </div>}
  </>;
}
