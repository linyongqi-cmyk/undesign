export const sourceCardText = 'この写真は著作権法上の関係により、出典のみ記載している。';
export const sourceCardLinkPrompt = '出典：';
export const sourceCardAspect = 4 / 3;

export function sourceCardDisplayText(linkText, href) {
  if (typeof linkText === 'string' && linkText.trim()) return linkText.trim();
  try { return new URL(href).hostname.replace(/^www\./i, ''); } catch { return ''; }
}

export function validExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export const freeSizeItemZone = (itemId) => `component-${itemId}`;
