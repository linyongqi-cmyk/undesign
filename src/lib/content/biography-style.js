const fontStacks = {
  'system-sans': 'Arial, sans-serif',
  'system-serif': 'Georgia, serif',
  'noto-sans-jp': '"Noto Sans JP", sans-serif',
  monospace: 'monospace',
};

export function biographyTextStyle(profile, language) {
  const style = profile[`biographyStyle${language}`] || {};
  const font = profile[`biographyFont${language}`] || (language === 'Ja' ? 'Noto Sans JP' : 'Noto Sans SC');
  return {
    'font-family': fontStacks[font] || `"${font}", sans-serif`,
    'font-size': style.fontSize ? `${Number(style.fontSize)}px` : undefined,
    'font-weight': style.fontWeight,
    'line-height': style.lineHeight,
    'letter-spacing': style.letterSpacing === undefined ? undefined : `${Number(style.letterSpacing)}px`,
    'text-align': style.textAlign,
    'text-decoration': style.textDecoration,
    'font-style': style.fontStyle,
    color: style.color,
    '--bio-paragraph-spacing': `${Number(style.paragraphSpacing ?? 12)}px`,
  };
}
