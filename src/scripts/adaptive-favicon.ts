const darkMode = matchMedia('(prefers-color-scheme: dark)');
let lightIcon = '';
let darkIcon: Promise<string> | undefined;

async function invertIcon(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return source;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    pixels.data[index] = 255 - pixels.data[index];
    pixels.data[index + 1] = 255 - pixels.data[index + 1];
    pixels.data[index + 2] = 255 - pixels.data[index + 2];
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

async function updateFavicon() {
  const link = document.querySelector<HTMLLinkElement>('[data-adaptive-favicon]');
  if (!link) return;
  const source = link.dataset.originalHref ?? link.href;
  link.dataset.originalHref = source;

  if (source !== lightIcon) {
    lightIcon = source;
    darkIcon = undefined;
  }
  if (!darkMode.matches) {
    if (link.href !== source) link.href = source;
    return;
  }

  darkIcon ??= invertIcon(source).catch(() => source);
  const inverted = await darkIcon;
  if (link.isConnected && darkMode.matches && link.href !== inverted) link.href = inverted;
}

darkMode.addEventListener('change', updateFavicon);
document.addEventListener('astro:page-load', updateFavicon);
void updateFavicon();
