import React, { useEffect, useRef, useState } from 'react';
import { imageHoverSettings } from '../../lib/content/image-hover.js';
import { showImageHover } from '../../lib/content/image-hover-preview.js';
import { adminActionPaths } from '../../lib/admin/action-icons.js';

export default function ImageHoverSettings({ value, onChange, getFrame }) {
  const [draft, setDraft] = useState(() => imageHoverSettings(value));
  const [scaleText, setScaleText] = useState(() => String(imageHoverSettings(value).scale));
  const preview = useRef(null);
  useEffect(() => () => preview.current?.(), []);
  const scale = Number(scaleText.trim());
  const valid = scaleText.trim() !== '' && Number.isFinite(scale) && scale >= 1.1 && scale <= 2.5;
  const settings = { ...draft, scale };
  const update = (patch) => {
    preview.current?.();
    setDraft((current) => ({ ...current, ...patch }));
  };
  return <div className="puck-image-hover-settings">
    <div className="puck-image-hover-heading">
      <label className="puck-image-hover-toggle"><input type="checkbox" checked={draft.enabled} onChange={(event) => update({ enabled: event.target.checked })} />悬停放大</label>
      <button className="button puck-image-hover-play" type="button" aria-label="预览效果" title="预览效果" disabled={!draft.enabled || !valid} onClick={() => { preview.current?.(); preview.current = showImageHover(getFrame(), settings); }}><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3" /></svg></button>
      <button className="button button-dark admin-icon-button" type="button" aria-label="保存" title="保存" disabled={draft.enabled && !valid} onClick={() => { preview.current?.(); onChange(imageHoverSettings(draft.enabled ? settings : draft)); }}><svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={adminActionPaths.save} /></svg></button>
    </div>
    <div className="canvas-field"><span>缩放基点</span><div className="puck-image-hover-origins" role="group" aria-label="缩放基点">{[
      ['left', '左中'],
      ['center', '居中'],
      ['right', '右中'],
    ].map(([origin, label]) => <button key={origin} className="button admin-icon-button" type="button" aria-label={label} title={label} aria-pressed={draft.origin === origin} disabled={!draft.enabled} onClick={() => update({ origin })}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="4.5" cy="12" r={origin === 'left' ? 2 : 1} fill="currentColor" />
        <circle cx="12" cy="12" r={origin === 'center' ? 2 : 1} fill="currentColor" />
        <circle cx="19.5" cy="12" r={origin === 'right' ? 2 : 1} fill="currentColor" />
      </svg>
    </button>)}</div></div>
    <label className="canvas-field"><span>放大倍率</span><input type="text" name="hover-scale" autoComplete="off" inputMode="decimal" aria-label="放大倍率" aria-invalid={!valid} value={scaleText} disabled={!draft.enabled} onChange={(event) => { preview.current?.(); setScaleText(event.target.value); }} /></label>
    <div className="puck-image-hover-presets">{[1.25, 1.5, 1.75, 2, 2.5].map((value) => <button className="button" type="button" key={value} disabled={!draft.enabled} aria-pressed={valid && scale === value} onClick={() => { preview.current?.(); setScaleText(String(value)); }}>{value === 2 ? '2.0' : value}x</button>)}</div>
  </div>;
}
