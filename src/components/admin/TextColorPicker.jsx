import React, { useLayoutEffect, useRef, useState } from 'react';

function normalizeHex(value) {
  const hex = value.trim().replace(/^#/, '');
  if (/^[a-f\d]{3}$/i.test(hex)) return '#' + [...hex].map(digit => digit.repeat(2)).join('').toUpperCase();
  return /^[a-f\d]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : '';
}

const toRgb = (hex) => (normalizeHex(hex) || '#555555').slice(1).match(/../g).map(channel => parseInt(channel, 16));
const toHex = (rgb) => '#' + rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase();

function toHsv(rgb) {
  const [r, g, b] = rgb.map(channel => channel / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta) {
    if (max === r) hue = (g - b) / delta;
    else if (max === g) hue = 2 + (b - r) / delta;
    else hue = 4 + (r - g) / delta;
  }
  return [Math.round((hue * 60 + 360) % 360), Math.round(max ? delta / max * 100 : 0), Math.round(max * 100)];
}

function hsvToRgb([hue, saturation, value]) {
  const s = saturation / 100;
  const v = value / 100;
  return [5, 3, 1].map(offset => {
    const sector = (offset + hue / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(sector, 4 - sector, 1)));
  });
}

export default function TextColorPicker({ color, onChange }) {
  const popover = useRef(null);
  const swatch = useRef(null);
  const [mode, setMode] = useState('HEX');
  const [hexDraft, setHexDraft] = useState(color);
  const [hsv, setHsv] = useState(() => toHsv(toRgb(color)));
  const rgb = toRgb(color);

  const positionPopover = () => {
    const panel = popover.current;
    const anchor = swatch.current.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const below = anchor.bottom + 5;
    panel.style.left = `${Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))}px`;
    panel.style.top = `${below + height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - height - 5)}px`;
  };

  useLayoutEffect(() => {
    if (popover.current.matches(':popover-open')) positionPopover();
  }, [mode]);

  const toggle = () => {
    const panel = popover.current;
    if (panel.matches(':popover-open')) {
      panel.hidePopover();
      return;
    }
    setMode('HEX');
    setHexDraft(color);
    setHsv(toHsv(rgb));
    panel.showPopover();
    positionPopover();
  };

  const updateHsv = (next) => {
    const hex = toHex(hsvToRgb(next));
    setHsv(next);
    setHexDraft(hex);
    onChange(hex);
  };

  const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));
  const pickFromBoard = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateHsv([
      hsv[0],
      clampPercent((event.clientX - bounds.left) / bounds.width * 100),
      clampPercent((bounds.bottom - event.clientY) / bounds.height * 100),
    ]);
  };
  const moveOnBoard = (event) => {
    const step = event.shiftKey ? 10 : 1;
    const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowDown: [0, -step], ArrowUp: [0, step] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    updateHsv([hsv[0], clampPercent(hsv[1] + direction[0]), clampPercent(hsv[2] + direction[1])]);
  };

  return <div className="puck-text-style-field">
    <span>文字颜色</span>
    <button ref={swatch} className="text-color-swatch" type="button" aria-label="选择文字颜色" aria-haspopup="dialog" onClick={toggle} style={{ backgroundColor: color }} />
    <div className="text-color-popover" ref={popover} popover="auto" role="dialog" aria-label="文字拾色器">
      <div
        className="text-color-board"
        role="group"
        aria-label="色板，左右调饱和度，上下调明度"
        tabIndex={0}
        style={{ backgroundColor: `hsl(${hsv[0]} 100% 50%)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pickFromBoard(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pickFromBoard(event);
        }}
        onKeyDown={moveOnBoard}
      >
        <span aria-hidden="true" style={{ left: `${hsv[1]}%`, top: `${100 - hsv[2]}%`, backgroundColor: color }} />
      </div>
      <input className="text-color-hue" type="range" min="0" max="360" aria-label="色相" value={hsv[0]} onChange={(event) => updateHsv([Number(event.target.value), hsv[1], hsv[2]])} />
      <select name="color-mode" aria-label="拾色器模式" value={mode} onChange={(event) => { setMode(event.target.value); setHexDraft(color); }}>
        <option>HEX</option><option>HSV</option><option>RGB</option>
      </select>
      {mode === 'HEX' ? <input name="hex-color" autoComplete="off" spellCheck={false} aria-label="HEX 颜色值" value={hexDraft} maxLength={7} onChange={(event) => {
        const value = event.target.value;
        setHexDraft(value);
        const normalized = normalizeHex(value);
        if (normalized) {
          setHsv(toHsv(toRgb(normalized)));
          onChange(normalized);
        }
      }} onBlur={() => setHexDraft(color)} /> : (mode === 'RGB' ? ['R', 'G', 'B'] : ['H', 'S', 'V']).map((label, index) => {
        const isRgb = mode === 'RGB';
        const channels = isRgb ? rgb : hsv;
        const max = isRgb ? 255 : index === 0 ? 360 : 100;
        return <label key={label}><span>{label}</span><input type="range" min="0" max={max} value={channels[index]} onChange={(event) => {
          const next = channels.map((channel, i) => i === index ? Number(event.target.value) : channel);
          setHsv(isRgb ? toHsv(next) : next);
          onChange(toHex(isRgb ? next : hsvToRgb(next)));
        }} /><output>{channels[index]}</output></label>;
      })}
    </div>
  </div>;
}
