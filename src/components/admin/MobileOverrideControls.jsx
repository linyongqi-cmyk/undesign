import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerOverlayPortal } from '@puckeditor/core';
import { hasMobileOverride, normalizeMobileOverride } from '../../lib/content/mobile-override.js';

export const CanvasViewportContext = createContext('desktop');

const VIEWPORT_STORAGE_KEY = 'portfolio-admin-canvas-viewport';
let savedCanvasViewport = 'desktop';

export function readSavedCanvasViewport() {
  try {
    const stored = window.localStorage?.getItem(VIEWPORT_STORAGE_KEY);
    if (stored === 'mobile' || stored === 'desktop') {
      savedCanvasViewport = stored;
      return stored;
    }
  } catch {
    // Ignore storage access errors.
  }
  return savedCanvasViewport;
}

export function saveCanvasViewport(next) {
  const value = next === 'mobile' ? 'mobile' : 'desktop';
  savedCanvasViewport = value;
  try {
    window.localStorage?.setItem(VIEWPORT_STORAGE_KEY, value);
  } catch {
    // Ignore storage access errors.
  }
  return value;
}

const layoutOptions = [
  ['stack', '单列'],
  ['keep', '保持横排'],
  ['columns2', '2列'],
  ['scroll', '横滑'],
];

const alignOptions = [
  ['left', '左'],
  ['center', '中'],
  ['right', '右'],
];

export function MobileHiddenPlaceholder({ label = '组件', onRestore }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    return registerOverlayPortal(node, { disableDrag: true });
  }, []);
  return <div ref={ref} className="mobile-hidden-placeholder" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
    <span>已隐藏 · {label}</span>
    <button type="button" className="mobile-hidden-restore" onClick={(e) => { e.stopPropagation(); onRestore?.(); }}>显示</button>
  </div>;
}

export function MobileOverrideBar({
  label = '组件',
  mobile,
  supportsLayout = false,
  supportsWidth = false,
  supportsCrop = false,
  hasMobileCrop = false,
  onChangeMobile,
  onOpenMobileCrop,
  onResetMobileCrop,
  className = '',
}) {
  const viewport = useContext(CanvasViewportContext);
  const barRef = useRef(null);
  const panelRef = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const id = useId();
  const attachPanel = useCallback((node) => {
    panelRef.current = node;
    setPortalTarget(node);
  }, []);

  useEffect(() => {
    const node = barRef.current;
    if (viewport !== 'mobile' || !node) return undefined;
    return registerOverlayPortal(node, { disableDrag: true });
  }, [viewport]);

  if (viewport !== 'mobile') return null;
  const normalized = normalizeMobileOverride(mobile) || {};
  const active = hasMobileOverride(normalized) || hasMobileCrop;

  const patchMobile = (patch) => {
    const next = normalizeMobileOverride({ ...normalized, ...patch });
    onChangeMobile?.(next);
  };

  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    if (panel.matches(':popover-open')) return panel.hidePopover();
    const anchor = event.currentTarget.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(anchor.right + 6, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(anchor.top, window.innerHeight - 360));
    setPosition({ left, top });
    panel.showPopover();
  };

  return <div ref={barRef} className={`mobile-override-bar${className ? ` ${className}` : ''}`} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
    <button type="button" className="puck-image-action" aria-label={`在手机端隐藏${label}`} title="在手机端隐藏" onClick={() => patchMobile({ hidden: true })}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9 3.5 10 7a11.3 11.3 0 0 1-3.1 4.4M6.5 6.6A11.4 11.4 0 0 0 2 12c1 3.5 5 7 10 7a10.4 10.4 0 0 0 5.4-1.5" /></svg>
    </button>
    <button type="button" className={`puck-image-action mobile-override-settings-btn${active ? ' has-override' : ''}`} aria-label={`${label}手机端设置`} title="手机端排版设置" aria-expanded={open} aria-controls={id} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>
    </button>
    <div ref={attachPanel} id={id} popover="auto" role="dialog" aria-label={`${label}手机端设置`} className="puck-component-settings-menu mobile-override-panel" style={{ left: `${position.left}px`, top: `${position.top}px` }} onToggle={(e) => setOpen(e.newState === 'open')} onClick={(e) => e.stopPropagation()}>
      {portalTarget && createPortal(<>
        <header>{label} · 手机端<button type="button" className="button" aria-label="关闭手机端设置" onClick={() => panelRef.current?.hidePopover()}>×</button></header>
        <div className="mobile-override-panel-body">
          {supportsLayout && <section className="mobile-override-section">
            <h4>手机端排列</h4>
            <div className="mobile-override-segmented">
              {layoutOptions.map(([value, title]) => <button key={value} type="button" aria-pressed={(normalized.layout || 'stack') === value} onClick={() => patchMobile({ layout: value === 'stack' ? undefined : value })}>{title}</button>)}
            </div>
          </section>}
          {supportsWidth && <section className="mobile-override-section">
            <h4>手机端宽度与对齐</h4>
            <div className="mobile-override-width-row">
              <input type="range" min="10" max="100" step="1" value={normalized.displayWidth ?? 100} aria-label="手机端显示宽度" onChange={(e) => patchMobile({ displayWidth: Number(e.target.value) })} />
              <output>{normalized.displayWidth ? `${normalized.displayWidth}%` : '100%'}</output>
            </div>
            <div className="mobile-override-presets">
              {[50, 75, 100].map((w) => <button key={w} type="button" aria-pressed={normalized.displayWidth === w} onClick={() => patchMobile({ displayWidth: w })}>{w}%</button>)}
              <button type="button" aria-pressed={normalized.displayWidth === undefined && normalized.align === undefined} onClick={() => patchMobile({ displayWidth: undefined, align: undefined })}>继承</button>
            </div>
            <div className="mobile-override-segmented">
              {alignOptions.map(([value, title]) => <button key={value} type="button" aria-pressed={(normalized.align || 'left') === value} onClick={() => patchMobile({ align: value === 'left' && (!normalized.displayWidth || normalized.displayWidth === 100) ? undefined : value })}>{title}</button>)}
            </div>
          </section>}
          {supportsCrop && <section className="mobile-override-section">
            <h4>手机端裁切</h4>
            <div className="mobile-override-crop-actions">
              <button type="button" className="button" onClick={() => { panelRef.current?.hidePopover(); onOpenMobileCrop?.(); }}>调整手机端裁切</button>
              {hasMobileCrop && <button type="button" className="button button-quiet" onClick={() => onResetMobileCrop?.()}>重置</button>}
            </div>
          </section>}
          <section className="mobile-override-section mobile-override-footer">
            <button type="button" className="button button-quiet" onClick={() => { panelRef.current?.hidePopover(); patchMobile({ hidden: true }); }}>在手机端隐藏</button>
            {hasMobileOverride(normalized) && <button type="button" className="button button-quiet" onClick={() => { onChangeMobile?.(undefined); }}>恢复继承桌面</button>}
          </section>
        </div>
      </>, portalTarget)}
    </div>
  </div>;
}
