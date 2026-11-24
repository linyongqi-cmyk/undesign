import React, { createContext, useContext, useId, useRef, useState, useCallback } from 'react';

export const CanvasMenuContext = createContext(null);

import { createPortal } from 'react-dom';

function flatten(children) {
  return React.Children.toArray(children).flatMap(child => React.isValidElement(child) && child.type === React.Fragment ? flatten(child.props.children) : [child]);
}

function category(child) {
  if (!React.isValidElement(child)) return '内容与链接';
  const props = child.props;
  const name = typeof child.type === 'function' ? child.type.name : '';
  const label = props['aria-label'] || props.label || '';
  if (name === 'CanvasGroupBadge') return '标识';
  if (name === 'GroupOrderAction') return '排序';
  if (name === 'DeleteCanvasAction' || /删除/.test(label)) return '删除';
  if (/更换|上传|选择本地/.test(label) || ['replace', 'add'].includes(props['data-image-action'])) return '快捷';
  if (/Indent|Width|LayoutNumber|ImageRow|GroupOrder|GroupBadge/.test(name) || /宽度|间距|群组|顺序|横向图片|显示模式/.test(label)) return '布局';
  if (props.icon === 'zoomIn' || props['data-image-action'] === 'crop' || /裁切|悬停/.test(label)) return '图片效果';
  return '内容与链接';
}

export default function CanvasActionMenu({ children, disabled = false }) {
  const panel = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const attachPanel = useCallback(node => {
    panel.current = node;
    setPortalTarget(node);
  }, []);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  if (disabled) return children;
  const groups = {};
  for (const child of flatten(children)) {
    if (!child) continue;
    const group = category(child);
    (groups[group] ||= []).push(child);
  }
  const groupMenu = Boolean(groups['标识'] || groups['排序']);
  const title = groupMenu ? '群组设置' : '组件设置';
  const toggle = event => {
    event.stopPropagation();
    if (panel.current.matches(':popover-open')) return panel.current.hidePopover();
    const anchor = event.currentTarget.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const right = anchor.right + 6;
    setPosition({ left: Math.max(12, Math.min(right, window.innerWidth - width - 12)), top: Math.max(12, Math.min(anchor.top, window.innerHeight - 340)) });
    panel.current.showPopover();
  };
  return <>
    <button type="button" className={`puck-image-action puck-component-settings${groupMenu ? ' is-group-settings' : ''}`} aria-label={title} title={title} aria-expanded={open} aria-controls={id} onClickCapture={toggle}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg><span>设置</span></button>
    <div className="puck-toolbar-quick puck-toolbar-replace">{groups['快捷']}</div>
    <div className="puck-toolbar-quick puck-toolbar-order">{groups['排序']}</div>
    <div className="puck-toolbar-quick puck-toolbar-delete">{groups['删除']}</div>
    <div ref={attachPanel} id={id} popover="auto" role="dialog" aria-label={title} className="puck-component-settings-menu" style={{ left: `clamp(12px, ${position.left}px, max(12px, calc(100vw - 312px)))`, top: `clamp(12px, ${position.top}px, max(12px, calc(100dvh - 420px)))`, maxHeight: `calc(100dvh - clamp(12px, ${position.top}px, max(12px, calc(100dvh - 420px))) - 12px)` }} onToggle={event => { const next = event.newState === 'open'; setOpen(next); if (!next) setActiveKey(null); }} onClick={event => {
      // Controls must reach React before Puck's native component-selection
      // listener can re-render a controlled checkbox back to its old value.
      // Delegated media actions still bubble to their existing editor handlers.
      if (!event.target.closest('[data-image-action], [data-carousel-action]')) event.stopPropagation();
    }}>
      {portalTarget && createPortal(<>
      <header>{title}<button type="button" className="button" aria-label={`关闭${title}`} onClick={() => panel.current.hidePopover()}>×</button></header>
      <CanvasMenuContext.Provider value={{ inline: true, activeKey, setActiveKey }}>
      {['布局', '内容与链接', '图片效果'].map(group => groups[group]?.length ? <section key={group} className={group === '删除' ? 'is-danger' : ''}><h4>{group === '删除' ? '管理' : group}</h4><div className="puck-component-settings-list">{groups[group]}</div></section> : null)}
      </CanvasMenuContext.Provider>
      </>, portalTarget)}
    </div>
  </>;
}
