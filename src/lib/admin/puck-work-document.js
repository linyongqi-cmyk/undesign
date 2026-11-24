import { freeSizeItemZone } from '../content/free-media.js';
import { imageData, mediaCaptionFields } from '../content/media-caption.js';
import { normalizeMobileOverride } from '../content/mobile-override.js';
import { researchArticleLanguage, workBodySections } from '../content/work-body-sections.js';
import { photographyGallery2Sections } from '../content/photography-gallery2.js';

const puckKinds = {
  richText: 'ParagraphBlock',
  paragraph: 'ParagraphBlock',
  subheading: 'SubheadingBlock',
  note: 'NoteBlock',
  internalLink: 'InternalLinkBlock',
  externalLink: 'ExternalLinkBlock',
  imageWithCaption: 'ImageBlock',
  imagePair: 'MediaCompositionBlock',
  mediaComposition: 'MediaCompositionBlock',
  imageCarousel: 'ImageCarouselBlock',
  sourceCard: 'SourceCardBlock',
  freeSizeGroup: 'FreeSizeGroupBlock',
  localVideo: 'LocalVideoBlock',
  videoEmbed: 'VideoEmbedBlock',
  wideMedia: 'WideMediaBlock',
  quote: 'QuoteBlock',
  specifications: 'SpecificationsBlock',
  link: 'ExternalLinkBlock',
};

const splitMediaKinds = new Set(['imageWithCaption', 'imagePair', 'mediaComposition', 'imageCarousel', 'sourceCard', 'freeSizeGroup']);

// Stored paragraph text may be a single string (legacy/direct edits) or an
// array of strings/paragraph objects. Puck always expects one entry per paragraph.
function textParagraphs(text) {
  const items = Array.isArray(text) ? text : typeof text === 'string' ? [text] : [];
  return items.map((item) => typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : '');
}

function galleryImageProps(props = {}) {
  const { id, __galleryImage, blockIndent, blockIndentSize, displayWidth, displayHeight, mobile, ...image } = props;
  return image;
}

export function photographyGalleryPuckBlocks(gallery = []) {
  return gallery.map((image, index) => ({
    type: 'ImageBlock',
    props: {
      id: `ImageBlock-photographyGallery2-${index + 1}`,
      ...(typeof image === 'string' ? { src: image, alt: '', caption: '' } : image),
      __galleryImage: true,
    },
  }));
}

export function photographyGalleryImages(blocks = []) {
  return blocks
    .filter((block) => block?.type === 'ImageBlock')
    .map((block) => galleryImageProps(block.props || {}))
    .filter((image) => image.src);
}

function toPuckBlock(block, index, zone, nestedZones) {
  const component = readPuckBlock(block, index, zone, nestedZones);
  if (component && block.blockIndentSize !== undefined) component.props.blockIndentSize = block.blockIndentSize;
  if (component && block.blockIndent !== undefined) component.props.blockIndent = block.blockIndent;
  if (component && block.displayHeight !== undefined) component.props.displayHeight = block.displayHeight;
  if (component && block.displayWidth !== undefined) component.props.displayWidth = block.displayWidth;
  const mobile = normalizeMobileOverride(block?.mobile);
  if (component && mobile) component.props.mobile = mobile;
  return component;
}

function readPuckBlock(block, index, zone = 'content', nestedZones = {}) {
  if (!block || typeof block !== 'object') return null;
  const key = encodeURIComponent(zone);
  if (block.kind === 'componentGroup' || block.kind === 'layoutGroup') {
    const type = block.kind === 'layoutGroup' ? 'LayoutGroupBlock' : 'ResearchGroupBlock';
    const id = `${type}-${key}-${index + 1}`;
    const childZone = `${id}:items`;
    const children = (Array.isArray(block.items) ? block.items : []).map((item, childIndex) => toPuckBlock(item, childIndex, childZone, nestedZones)).filter(Boolean);
    if (!children.length) return null;
    nestedZones[childZone] = children;
    if (block.layout === 'side') {
      const sideZone = `${id}:side`;
      nestedZones[sideZone] = (block.sideItems || []).map((item, i) => toPuckBlock(item, i, sideZone, nestedZones)).filter(Boolean);
    }
    return { type, props: { id, ...(block.kind === 'layoutGroup' ? { layout: block.layout, sideGap: block.sideGap, sideMatchHeight: block.sideMatchHeight, sideAlign: block.sideAlign, rowMode: block.rowMode, rowHeight: block.rowHeight } : {}) } };
  }
  const type = puckKinds[block.kind];
  if (!type) return null;
  let props;
  if (['richText', 'paragraph', 'note'].includes(block.kind)) props = { text: textParagraphs(block.text).map((text) => ({ text })) };
  else if (block.kind === 'subheading') props = { text: block.text || '' };
  else if (block.kind === 'imageWithCaption') props = { ...block.image };
  else if (block.kind === 'imagePair' || block.kind === 'mediaComposition') {
    const columns = block.kind === 'imagePair'
      ? (block.images || []).map((image) => ({ items: [{ kind: 'image', image }] }))
      : Array.isArray(block.columns) ? block.columns : (block.items || []).map((item) => ({ items: [item] }));
    props = { ...(block.overflowRight ? { overflowRight: true, ...(block.overflowSettings ? { overflowSettings: block.overflowSettings } : {}) } : {}), columns: columns.map((column) => ({ items: (column.items || []).map((item) => item.kind === 'imageCarousel'
      ? { ...item, images: (item.images || []).map((image) => ({ ...image })) }
      : item.kind === 'content' ? { kind: 'content', block: { ...(item.block || {}) } }
      : { ...item, kind: 'image', image: { ...(item.image || {}) } }) })) };
  }
  else if (block.kind === 'imageCarousel') {
    const images = block.images || [];
    props = { images: images.map((image) => ({ ...image })), ...mediaCaptionFields(block) };
  }
  else if (block.kind === 'freeSizeGroup') {
    if (!Array.isArray(block.items) || !block.items.length) return null;
    const groupId = `${type}-${key}-${index + 1}`;
    const items = (block.items || []).map((item, itemIndex) => ({ ...item, id: item.id || `${groupId}-item-${itemIndex + 1}`, ...(item.image ? { image: { ...item.image } } : {}), ...(item.images ? { images: item.images.map((image) => ({ ...image })) } : {}) }));
    for (const item of items) {
      if (item.kind !== 'component') continue;
      const zone = `${groupId}:${freeSizeItemZone(item.id)}`;
      const child = toPuckBlock(item.block, 0, zone, nestedZones);
      if (child) nestedZones[zone] = [child];
      delete item.block;
    }
    props = { mode: block.mode || 'work', anchorItemId: block.anchorItemId || items[0]?.id || '', height: block.height || 320, overflowRight: block.overflowRight === true, items };
  }
  else if (block.kind === 'internalLink' || block.kind === 'externalLink' || block.kind === 'localVideo' || block.kind === 'videoEmbed' || block.kind === 'wideMedia' || block.kind === 'sourceCard') props = { ...block };
  else if (block.kind === 'link') props = { text: block.linkLabel || '', href: block.linkHref || '', newTab: true };
  else if (block.kind === 'specifications') props = { items: block.items || [
    { label: 'dimensions', value: block.dimensions || '' },
    { label: 'material', value: block.material || '' },
    { label: 'date', value: block.date || '' },
  ] };
  else props = { ...block };
  return { type, props: { id: `${type}-${key}-${index + 1}`, ...props, ...(block.blockIndent ? { blockIndent: block.blockIndent } : {}) } };
}


function mediaItemsFromPuck(block, zones) {
  const value = block?.props || {};
  let items = [];
  if (block.type === 'ImageBlock') items = [{ kind: 'image', image: imageData(value) }];
  else if (block.type === 'ImageCarouselBlock') items = [{ kind: 'imageCarousel', images: (value.images || []).map(imageData), ...mediaCaptionFields(value) }];
  else if (block.type === 'MediaCompositionBlock') items = (value.columns || (value.items || []).map((item) => ({ items: [item] }))).flatMap((column) => column.items || []).map((item) => item.kind === 'imageCarousel' ? { kind: 'imageCarousel', images: (item.images || []).map(imageData), ...mediaCaptionFields(item) } : item.kind === 'content' ? { kind: 'content', block: { ...(item.block || {}) } } : { kind: 'image', image: imageData(item.image) });
  const nestedZone = value.id ? value.id + ':right' : '';
  for (const child of zones?.[nestedZone] || []) items = [...items, ...mediaItemsFromPuck(child, zones)];
  return items;
}

function mediaColumnsFromPuck(block, zones = {}) {
  const value = block?.props || {};
  let columns = block?.type === 'MediaCompositionBlock'
    ? (value.columns || (value.items || []).map((item) => ({ items: [item] }))).map((column) => ({ items: (column.items || []).map((item) => {
      const mobile = normalizeMobileOverride(item.mobile);
      const mobileField = mobile ? { mobile } : {};
      return item.kind === 'imageCarousel' ? { kind: 'imageCarousel', images: (item.images || []).map(imageData), ...mediaCaptionFields(item), ...mobileField } : item.kind === 'content' ? { kind: 'content', block: { ...(item.block || {}) }, ...mobileField } : { kind: 'image', image: imageData(item.image), ...mobileField };
    }) }))
    : [{ items: mediaItemsFromPuck({ ...block, props: { ...value, id: undefined } }, {}) }];
  const nestedZone = value.id ? `${value.id}:right` : '';
  const nestedColumns = (zones[nestedZone] || []).flatMap((child) => mediaColumnsFromPuck(child, zones));
  if (nestedColumns.length) columns = [...columns, ...nestedColumns];
  return columns;
}

function fromPuckBlock(block, zones = {}) {
  const content = writePuckBlock(block, zones);
  if (content && block.props?.blockIndent !== undefined) content.blockIndent = block.props.blockIndent;
  if (content && block.props?.blockIndentSize !== undefined) content.blockIndentSize = block.props.blockIndentSize;
  if (content && block.props?.displayHeight !== undefined) content.displayHeight = block.props.displayHeight;
  if (content && block.props?.displayWidth !== undefined) content.displayWidth = block.props.displayWidth;
  const mobile = normalizeMobileOverride(block?.props?.mobile);
  if (content && mobile) content.mobile = mobile;
  return content;
}

function writePuckBlock(block, zones) {
  if (!block || typeof block !== 'object') return null;
  const value = block?.props || {};
  const indent = value.blockIndent ? { blockIndent: value.blockIndent } : {};
  if (block.type === 'ResearchGroupBlock' || block.type === 'LayoutGroupBlock') {
    const items = (zones[`${value.id || ''}:items`] || []).map((child) => fromPuckBlock(child, zones)).filter(Boolean);
    if (value.layout === 'side') {
      const sideItems = (zones[`${value.id}:side`] || []).map((child) => fromPuckBlock(child, zones)).filter(Boolean);
      if (!items.length) return null;
      return { kind: 'layoutGroup', layout: 'side', items, sideItems,
        ...(value.sideGap === undefined ? {} : { sideGap: value.sideGap }),
        ...(value.sideMatchHeight ? { sideMatchHeight: true } : {}),
        ...(value.sideAlign === 'bottom' ? { sideAlign: 'bottom' } : {}),
      };
    }
    if (!items.length) return null;
    return block.type === 'LayoutGroupBlock'
      ? { kind: 'layoutGroup', layout: value.layout, items,
        ...(value.layout === 'row' && value.rowMode === 'fixedHeight' && items.length && items.every((item) => (item.kind === 'imageWithCaption' && item.image?.src) || item.kind === 'sourceCard')
          ? { rowMode: 'fixedHeight', rowHeight: Number(value.rowHeight) || 200 } : value.rowMode === 'fixedWidth' ? { rowMode: 'fixedWidth' } : {}) }
      : { kind: 'componentGroup', items };
  }
  if (block.type === 'ParagraphBlock') return { ...indent, kind: 'paragraph', text: textParagraphs(value.text) };
  if (block.type === 'SubheadingBlock') return { ...indent, kind: 'subheading', text: value.text || '' };
  if (block.type === 'NoteBlock') return { ...indent, kind: 'note', text: textParagraphs(value.text) };
  if (block.type === 'InternalLinkBlock') return { ...indent, kind: 'internalLink', text: value.text || '', category: value.category || '', ...(value.workSlug ? { workSlug: value.workSlug } : {}) };
  if (block.type === 'ExternalLinkBlock') return { ...indent, kind: 'externalLink', text: value.text || '', href: value.href || '', newTab: value.newTab !== false };
  if (block.type === 'ImageBlock') {
    if ((zones[(value.id || '') + ':right'] || []).length) return { kind: 'mediaComposition', columns: mediaColumnsFromPuck(block, zones), ...(value.overflowRight ? { overflowRight: true } : {}) };
    return { kind: 'imageWithCaption', image: imageData(value) };
  }
  if (block.type === 'LocalVideoBlock') return { kind: 'localVideo', src: value.src || '', ...mediaCaptionFields(value) };
  if (block.type === 'VideoEmbedBlock') return { kind: 'videoEmbed', url: value.url || '', ...mediaCaptionFields(value) };
  if (block.type === 'WideMediaBlock') return { kind: 'wideMedia', items: value.items || [], caption: value.caption || '' };
  if (block.type === 'SourceCardBlock') return { kind: 'sourceCard', text: value.text || '', ...(value.linkText ? { linkText: value.linkText } : {}), ...(value.href ? { href: value.href } : {}), ...mediaCaptionFields(value) };
  if (block.type === 'FreeSizeGroupBlock') {
    const items = (value.items || []).flatMap((item) => {
      if (!item?.id) return [];
      const mobile = normalizeMobileOverride(item.mobile);
      const mobileField = mobile ? { mobile } : {};
      if (item.kind === 'component') {
        const block = fromPuckBlock(zones[`${value.id}:${freeSizeItemZone(item.id)}`]?.[0], zones);
        return block ? [{ ...item, ...mobileField, block }] : [];
      }
      if (!['image', 'imageCarousel', 'localVideo', 'videoEmbed', 'sourceCard'].includes(item.kind)) return [];
      const { mobile: _ignored, ...rest } = item;
      return [{ ...rest, ...mobileField }];
    });
    if (!items.length) return null;
    return { kind: 'freeSizeGroup', mode: value.mode === 'research' ? 'research' : 'work', ...(value.overflowRight ? { overflowRight: true } : {}), ...(items.some((item) => item.id === value.anchorItemId) ? { anchorItemId: value.anchorItemId } : {}), ...(Number.isFinite(Number(value.height)) && Number(value.height) > 0 ? { height: Number(value.height) } : {}), items };
  }
  if (block.type === 'MediaCompositionBlock') {
    const allColumns = mediaColumnsFromPuck(block, zones);
    const getImage = (image) => imageData(image);
    const columns = allColumns.map((column) => ({ items: column.items.map((item) => {
      const mobile = normalizeMobileOverride(item.mobile);
      const mobileField = mobile ? { mobile } : {};
      return item.kind === 'imageCarousel'
        ? { kind: 'imageCarousel', images: (item.images || []).map(getImage), ...mediaCaptionFields(item), ...mobileField }
        : item.kind === 'content' ? { kind: 'content', block: item.block, ...mobileField }
        : { kind: 'image', image: getImage(item.image), ...mobileField };
    }) }));
    return { kind: 'mediaComposition', columns, ...(value.overflowRight ? { overflowRight: true, ...(value.overflowSettings ? { overflowSettings: value.overflowSettings } : {}) } : {}) };
  }
  if (block.type === 'ImageCarouselBlock') {
    const images = value.images || [];
    if ((zones[(value.id || '') + ':right'] || []).length) return { kind: 'mediaComposition', columns: mediaColumnsFromPuck(block, zones), ...(value.overflowRight ? { overflowRight: true } : {}) };
    return { kind: 'imageCarousel', images: images.map(imageData), ...mediaCaptionFields(value) };
  }
  if (block.type === 'QuoteBlock') return { ...indent, kind: 'quote', quote: value.quote || '' };
  if (block.type === 'SpecificationsBlock') return { ...indent, kind: 'specifications', items: value.items || [
    { label: 'dimensions', value: value.dimensions || '' },
    { label: 'material', value: value.material || '' },
    { label: 'date', value: value.date || '' },
  ] };
  if (block.type === 'LinkBlock') return { ...indent, kind: 'externalLink', text: value.linkLabel || '', href: value.linkHref || '', newTab: true };
  return null;
}

export function workToPuckDocument(work) {
  const isSplitDetail = work.template === 'splitDetail';
  const bodySections = workBodySections(work);
  const gallery = work.gallery?.length ? work.gallery : [];
  const legacySections = isSplitDetail && !Array.isArray(work.leftSections) ? work.sections || [] : [];
  const legacyLeft = new Set(legacySections.filter((block) => splitMediaKinds.has(block.kind)));
  const existingLeftSections = [
    ...(work.leftSections || []),
    ...legacyLeft,
  ];
  const rightSections = isSplitDetail ? bodySections.filter((block) => !legacyLeft.has(block)) : [];
  const nestedZones = {};
  const sectionsToPuck = (sections, zone) => {
    return sections.map((block, index) => toPuckBlock(block, index, zone, nestedZones)).filter(Boolean);
  };
  const galleryBlocks = isSplitDetail ? gallery.map((image, index) => {
    const block = toPuckBlock({
      kind: 'imageWithCaption',
      image: typeof image === 'string' ? { src: image, alt: '', caption: '' } : image,
    }, index, 'gallery');
    return { ...block, props: { ...block.props, __galleryImage: true } };
  }) : [];
  const leftSections = [...galleryBlocks, ...sectionsToPuck(existingLeftSections, 'left')];
  const rightBlocks = isSplitDetail ? sectionsToPuck(rightSections, 'right') : [];
  const photographyGallery2Source = photographyGallery2Sections(work);
  const photographyGallery2RightBlocks = work.template === 'photographyGallery2'
    ? sectionsToPuck(photographyGallery2Source, 'photographyGallery2Right')
    : [];
  const content = isSplitDetail ? [] : sectionsToPuck([...existingLeftSections, ...bodySections], 'content');
  const zones = {
    ...nestedZones,
    ...(isSplitDetail ? { 'root:left': leftSections, 'root:right': rightBlocks } : {}),
    ...(work.template === 'photographyGallery2' ? { 'root:photographyGallery2Right': photographyGallery2RightBlocks } : {}),
  };
  return {
    root: {
      props: {
        title: work.title || '',
        type: work.type || '',
        image: work.image || '',
        imageScale: work.imageScale || 1,
        imagePosition: work.imagePosition || 'center',
        masonryThumbnail: { ...(work.masonryThumbnail || {}) },
        template: work.template || 'articleReading',
        photographyLightboxEnabled: work.photographyLightboxEnabled === true,
        photographyIntroWidth: Number(work.photographyIntroWidth) || 45,
        seoTitle: work.seoTitle || '',
        seoDescription: work.seoDescription || '',
        ...(work.category === 'research' ? { articleLanguage: researchArticleLanguage(work) } : {}),
        gallery: gallery.map((item) => typeof item === 'string' ? ({ src: item, alt: '', caption: '' }) : item),
        gallerySourceWasExplicit: Boolean(work.gallery?.length),
      },
    },
    content,
    ...(Object.keys(zones).length ? { zones } : {}),
  };
}

export function puckDocumentToWork(document, original) {
  const props = document?.root?.props || {};
  const isSplitDetail = props.template === 'splitDetail';
  const splitLeftBlocks = document?.zones?.['root:left'] || [];
  const splitRightBlocks = document?.zones?.['root:right'] || [];
  const sections = (isSplitDetail ? splitRightBlocks : props.template === 'photographyGallery2' ? (document?.content || []) : [...splitLeftBlocks, ...splitRightBlocks, ...(document?.content || [])]).map((block) => fromPuckBlock(block, document?.zones || {})).filter(Boolean);
  const galleryBlockIndexes = [];
  for (const [index, block] of splitLeftBlocks.entries()) {
    if (block.type === 'ImageBlock' && block.props?.__galleryImage && block.props.displayWidth === undefined && block.props.displayHeight === undefined && !block.props.blockIndent) galleryBlockIndexes.push(index);
    else break;
  }
  const galleryBlocksAreContiguous = galleryBlockIndexes.length === splitLeftBlocks.filter((block) => block.props?.__galleryImage).length;
  const galleryImages = galleryBlockIndexes.map((index) => imageData(splitLeftBlocks[index].props || {})).filter((image) => image.src);
  const originalGallery = original.gallery;
  const originalGalleryImages = originalGallery?.length ? originalGallery : original.image ? [original.image] : [];
  const galleryIsUnchanged = galleryImages.length === originalGalleryImages.length && galleryImages.every((image, index) => {
    const source = originalGalleryImages[index];
    return JSON.stringify(image) === JSON.stringify(imageData(typeof source === 'string' ? { src: source } : source || {}));
  });
  const gallery = isSplitDetail
    ? (galleryIsUnchanged ? originalGallery : galleryBlocksAreContiguous ? galleryImages.map((image) => image.alt || image.caption || image.captionSettings || image.linkLabel || image.cropAspect || image.cropScale || image.cropPosition || image.hoverZoom ? image : image.src) : [])
    : props.template === 'photographyGallery2'
      ? photographyGalleryImages(document?.zones?.['root:photographyGallery2Right'] || [])
      : (props.gallery || []).filter((image) => image?.src).map((image) => ({ ...image }));
  const photographyGallery2Sections = props.template === 'photographyGallery2'
    ? (document?.zones?.['root:photographyGallery2Right'] || []).map((block) => fromPuckBlock(block, document?.zones || {})).filter(Boolean)
    : [];
  const leftSections = isSplitDetail
    ? splitLeftBlocks.slice(galleryBlocksAreContiguous ? galleryBlockIndexes.length : 0).map((block) => fromPuckBlock(block, document?.zones || {})).filter(Boolean)
    : [];
  return {
    ...original,
    title: typeof props.title === 'string' ? props.title : original.title,
    type: typeof props.type === 'string' ? props.type : original.type,
    date: original.category === 'research' ? original.date : undefined,
    description: '',
    dimensions: '',
    material: '',
    image: typeof props.image === 'string' ? props.image : original.image,
    imageScale: Number.isFinite(Number(props.imageScale)) ? Number(props.imageScale) : (original.imageScale || 1),
    imagePosition: typeof props.imagePosition === 'string' ? props.imagePosition : (original.imagePosition || 'center'),
    masonryThumbnail: { ...(props.masonryThumbnail || {}) },
    template: typeof props.template === 'string' ? props.template : original.template,
    photographyLightboxEnabled: props.photographyLightboxEnabled === true,
    ...(props.template === 'photographyGallery'
      ? { photographyIntroWidth: Math.min(100, Math.max(10, Number(props.photographyIntroWidth) || 45)) }
      : {}),
    seoTitle: typeof props.seoTitle === 'string' ? props.seoTitle : original.seoTitle,
    seoDescription: typeof props.seoDescription === 'string' ? props.seoDescription : original.seoDescription,
    ...(original.category === 'research' ? { articleLanguage: researchArticleLanguage({ ...original, articleLanguage: props.articleLanguage }) } : {}),
    gallery,
    photographyGallery2Sections: props.template === 'photographyGallery2' ? photographyGallery2Sections : undefined,
    leftSections: isSplitDetail || original.leftSections !== undefined ? leftSections : undefined,
    sections,
  };
}
