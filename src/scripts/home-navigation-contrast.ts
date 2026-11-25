function positionFraction(value: string, end: string) {
  if (value.endsWith('%')) return parseFloat(value) / 100;
  if (value === end) return 1;
  return value === 'left' || value === 'top' ? 0 : 0.5;
}

export function updateHomeNavigationContrast(cover: HTMLImageElement) {
  const sidebar = document.querySelector('.home-layout .sidebar');
  if (!sidebar || !cover.naturalWidth || !matchMedia('(min-width: 721px)').matches) return;
  const nav = sidebar.querySelector('nav');
  const rect = nav?.getBoundingClientRect();
  if (!nav || !rect?.width || !rect.height) return;
  const reveal = nav.querySelector<HTMLElement>('.nav-submenu-reveal');
  const revealHeight = reveal ? reveal.getBoundingClientRect().height : 0;
  const sampleHeight = Math.max(1, rect.height - revealHeight);

  const bounds = cover.getBoundingClientRect();
  const scale = Math.max(bounds.width / cover.naturalWidth, bounds.height / cover.naturalHeight);
  if (!scale) return;
  const [x, y = 'center'] = getComputedStyle(cover).objectPosition.split(' ');
  const imageLeft = bounds.left + (bounds.width - cover.naturalWidth * scale) * positionFraction(x, 'right');
  const imageTop = bounds.top + (bounds.height - cover.naturalHeight * scale) * positionFraction(y, 'bottom');
  const canvas = document.createElement('canvas');
  canvas.width = 12;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  context.drawImage(cover, (rect.left - imageLeft) / scale, (rect.top - imageTop) / scale,
    rect.width / scale, sampleHeight / scale, 0, 0, canvas.width, canvas.height);
  try {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let brightness = 0;
    for (let index = 0; index < data.length; index += 4) {
      brightness += 0.213 * data[index] + 0.715 * data[index + 1] + 0.072 * data[index + 2];
    }
    sidebar.setAttribute('data-cover-contrast', brightness / (data.length / 4) < 118 ? 'light' : 'dark');
  } catch {
    // Cross-origin covers may be displayed but cannot be sampled.
    sidebar.removeAttribute('data-cover-contrast');
  }
}
