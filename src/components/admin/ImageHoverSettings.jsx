import React, { useEffect, useRef, useState } from 'react';
import { imageHoverSettings } from '../../lib/content/image-hover.js';
import { showImageHover } from '../../lib/content/image-hover-preview.js';

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
      <button className="button puck-image-hover-play" type="button" aria-label="预览效果" title="预览效果" disabled={!draft.enabled || !valid} onClick={() => { preview.current?.(); preview.current = showImageHover(getFrame(), settings); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg></button>
      <button className="button" type="button" disabled={draft.enabled && !valid} onClick={() => { preview.current?.(); onChange(imageHoverSettings(draft.enabled ? settings : draft)); }}>应用</button>
    </div>
    <label className="canvas-field"><span>缩放基点</span><select aria-label="缩放基点" value={draft.origin} disabled={!draft.enabled} onChange={(event) => update({ origin: event.target.value })}>
      <option value="left">左中</option><option value="center">居中</option><option value="right">右中</option>
    </select></label>
    <label className="canvas-field"><span>放大倍率</span><input type="text" inputMode="decimal" aria-label="放大倍率" aria-invalid={!valid} value={scaleText} disabled={!draft.enabled} onChange={(event) => { preview.current?.(); setScaleText(event.target.value); }} /></label>
    <div className="puck-image-hover-presets">{[1.25, 1.5, 1.75, 2, 2.5].map((value) => <button className="button" type="button" key={value} disabled={!draft.enabled} aria-pressed={valid && scale === value} onClick={() => { preview.current?.(); setScaleText(String(value)); }}>{value === 2 ? '2.0' : value}x</button>)}</div>
  </div>;
}
