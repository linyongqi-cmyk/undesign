import React, { createContext, useContext, useId, useRef, useState } from 'react';

const ToolbarContext = createContext({ compact: false, toggle: () => {} });
const preferenceKey = 'portfolio-compact-tools';

export function ToolbarModeProvider({ children }) {
  const [compact, setCompact] = useState(() => typeof window === 'undefined' || localStorage.getItem(preferenceKey) !== 'classic');
  const toggle = () => setCompact(current => {
    const next = !current;
    localStorage.setItem(preferenceKey, next ? 'compact' : 'classic');
    return next;
  });
  return <ToolbarContext.Provider value={{ compact, toggle }}>{children}</ToolbarContext.Provider>;
}

export function ToolbarModeToggle() {
  const { compact, toggle } = useContext(ToolbarContext);
  return <button type="button" className="button puck-toolbar-mode-toggle" aria-label={compact ? '切换到原工具栏' : '切换到简洁工具栏'} onClick={toggle}>{compact ? '恢复原工具栏' : '使用简洁工具栏'}</button>;
}

function flatten(children) {
  return React.Children.toArray(children).flatMap(child => React.isValidElement(child) && child.type === React.Fragment ? flatten(child.props.children) : [child]);
}

function category(child) {
  if (!React.isValidElement(child)) return '内容与链接';
  const props = child.props;
  const name = typeof child.type === 'function' ? child.type.name : '';
  const label = props['aria-label'] || props.label || '';
  if (name === 'DeleteCanvasAction' || /删除/.test(label)) return '删除';
  if (/更换|上传|选择本地/.test(label) || ['replace', 'add'].includes(props['data-image-action'])) return '快捷';
  if (/Indent|Width|LayoutNumber|ImageRow|GroupOrder|GroupBadge/.test(name) || /宽度|间距|群组|顺序/.test(label)) return '布局';
  if (props.icon === 'zoomIn' || props['data-image-action'] === 'crop' || /裁切|悬停/.test(label)) return '图片效果';
  return '内容与链接';
}

export default function CanvasActionMenu({ children, disabled = false }) {
  const { compact } = useContext(ToolbarContext);
  const panel = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  if (!compact || disabled) return children;
  const groups = {};
  for (const child of flatten(children)) {
    if (!child) continue;
    const group = category(child);
    (groups[group] ||= []).push(child);
  }
  const toggle = event => {
    event.stopPropagation();
    if (panel.current.matches(':popover-open')) return panel.current.hidePopover();
    const anchor = event.currentTarget.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const right = anchor.right + 6;
    setPosition({ left: Math.max(12, Math.min(right, window.innerWidth - width - 12)), top: Math.max(12, Math.min(anchor.top, window.innerHeight - 340)) });
    panel.current.showPopover();
  };
  return <>
    <button type="button" className="puck-image-action puck-component-settings" aria-label="组件设置" title="组件设置" aria-expanded={open} aria-controls={id} onClick={toggle}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg><span>设置</span></button>
    {groups['快捷']}
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label="组件设置" className="puck-component-settings-menu" style={{ left: `clamp(12px, ${position.left}px, max(12px, calc(100vw - 252px)))`, top: `clamp(12px, ${position.top}px, max(12px, calc(100dvh - 420px)))` }} onToggle={event => setOpen(event.newState === 'open')} onClick={event => event.stopPropagation()}>
      <header>组件设置<button type="button" className="button" aria-label="关闭组件设置" onClick={() => panel.current.hidePopover()}>×</button></header>
      {['布局', '内容与链接', '图片效果', '删除'].map(group => groups[group]?.length ? <section key={group} className={group === '删除' ? 'is-danger' : ''}><h4>{group === '删除' ? '管理' : group}</h4><div className="puck-component-settings-list">{groups[group]}</div></section> : null)}
    </div>
  </>;
}
