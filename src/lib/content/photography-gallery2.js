export function photographyGallery2Sections(work = {}) {
  if (work.template !== 'photographyGallery2') return [];
  const stored = Array.isArray(work.photographyGallery2Sections) ? work.photographyGallery2Sections : [];
  if (stored.some((block) => block?.kind === 'imageWithCaption')) return stored;
  const legacyImages = Array.isArray(work.gallery) ? work.gallery.map((image) => ({
    kind: 'imageWithCaption',
    image: typeof image === 'string' ? { src: image, alt: '', caption: '' } : image,
  })) : [];
  return [...legacyImages, ...stored];
}
