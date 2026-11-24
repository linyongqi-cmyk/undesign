import { photographyGalleryImages, photographyGalleryPuckBlocks } from './puck-work-document.js';

const validTemplates = new Set(['splitDetail', 'articleReading', 'photographyGallery', 'photographyGallery2']);

export function switchPuckTemplate(previous, nextTemplate) {
  if (!validTemplates.has(nextTemplate)) return previous;
  const savedTemplate = previous.root?.props?.template;
  const previousTemplate = validTemplates.has(savedTemplate) ? savedTemplate : 'articleReading';
  if (previousTemplate === nextTemplate) return previous;
  const zones = previous.zones || {};
  let nextZones = { ...zones };
  let nextContent = previous.content || [];
  let gallery = Array.isArray(previous.root?.props?.gallery) ? previous.root.props.gallery : [];

  if (previousTemplate === 'photographyGallery2') {
    const photographyBlocks = nextZones['root:photographyGallery2Right'] || [];
    gallery = photographyGalleryImages(photographyBlocks);
    nextContent = [...nextContent, ...photographyBlocks.filter((block) => block.type !== 'ImageBlock')];
    delete nextZones['root:photographyGallery2Right'];
  }

  if (previousTemplate === 'splitDetail') {
    const leftBlocks = zones['root:left'] || [];
    const rightBlocks = zones['root:right'] || [];
    const firstContent = leftBlocks.findIndex((block) =>
      block.type !== 'ImageBlock' || !block.props?.__galleryImage || block.props.displayWidth !== undefined);
    const galleryCount = firstContent < 0 ? leftBlocks.length : firstContent;
    gallery = photographyGalleryImages(leftBlocks.slice(0, galleryCount));
    nextContent = [...leftBlocks.slice(galleryCount), ...rightBlocks, ...nextContent];
    delete nextZones['root:left'];
    delete nextZones['root:right'];
  }

  if (nextTemplate === 'splitDetail') {
    const media = nextContent.filter((block) => ['ImageBlock', 'MediaCompositionBlock', 'ImageCarouselBlock', 'LocalVideoBlock', 'VideoEmbedBlock', 'SourceCardBlock', 'FreeSizeGroupBlock', 'LayoutGroupBlock'].includes(block.type));
    const right = nextContent.filter((block) => !media.includes(block));
    nextContent = [];
    nextZones = {
      ...nextZones,
      'root:left': [...photographyGalleryPuckBlocks(gallery), ...(nextZones['root:left'] || []), ...media],
      'root:right': [...(nextZones['root:right'] || []), ...right],
    };
  }

  if (nextTemplate === 'photographyGallery2') {
    nextZones = { ...nextZones, 'root:photographyGallery2Right': photographyGalleryPuckBlocks(gallery) };
  }

  return {
    ...previous,
    root: { ...previous.root, props: { ...previous.root?.props, template: nextTemplate, gallery } },
    content: nextContent,
    zones: nextZones,
  };
}
