// Map site typography presets to the shared CSS variables used by captions and image text.
export function mediaCaptionStyle(preset = {}, language = '') {
  const fonts = { 'system-sans': 'Arial,"Yu Gothic",sans-serif', 'system-serif': 'Georgia,"Yu Mincho",serif', 'noto-sans-jp': '"Noto Sans JP","Yu Gothic",sans-serif', 'noto-sans-sc': '"Noto Sans SC",sans-serif', monospace: 'monospace' };
  return {
    '--text-font': ['zh', 'ja'].includes(language) ? fonts[language === 'zh' ? 'noto-sans-sc' : 'noto-sans-jp'] : fonts[preset.fontFamily] || fonts['system-sans'],
    '--text-size': `${Number(preset.fontSize) || 14}px`,
    '--text-weight': preset.fontWeight || 300,
    '--text-color': preset.color || '#555555',
    '--text-line-height': preset.lineHeight || 1.8,
    '--text-letter-spacing': `${Number(preset.letterSpacing) || 0}px`,
    '--text-align': preset.textAlign || 'left',
    '--text-decoration': preset.textDecoration || 'none',
    '--text-style': preset.fontStyle || 'normal',
    '--text-transform': preset.textTransform || 'none',
    '--text-writing-mode': preset.writingMode || 'horizontal-tb',
    '--text-indent': `${Number(preset.textIndent) || 0}px`,
    '--text-padding': `${Number(preset.paddingTop) || 0}px ${Number(preset.paddingRight) || 0}px ${Number(preset.paddingBottom) || 0}px ${Number(preset.paddingLeft) || 0}px`,
  };
}

// Keep the photography description's earlier note size while sharing paragraph typography settings.
export function photographyLightboxStyle(typography = {}) {
  const style = mediaCaptionStyle(typography.paragraph);
  const previousFontSize = Number(typography.note?.fontSize);
  style['--text-size'] = `${previousFontSize > 0 ? previousFontSize : 12}px`;
  return style;
}
