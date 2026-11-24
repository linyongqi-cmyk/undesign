import { freeSizeItemZone } from '../content/free-media.js';

export function findBlockById(data, id) {
  for (const blocks of [data.content || [], ...Object.values(data.zones || {})]) {
    const found = blocks.find((block) => block.props?.id === id);
    if (found) return found;
  }
  return null;
}

function findBlockLocation(data, id) {
  for (const [zone, blocks] of [['content', data.content || []], ...Object.entries(data.zones || {})]) {
    const index = blocks.findIndex((block) => block.props?.id === id);
    if (index >= 0) return { zone, blocks, index };
  }
  return null;
}

function replaceCollection(data, location, updateBlocks) {
  const nextBlocks = updateBlocks(location.blocks);
  if (location.zone === 'content') return { ...data, content: nextBlocks };
  return { ...data, zones: { ...data.zones, [location.zone]: nextBlocks } };
}

const layouts = {
  'below-stack': 'column',
  right: 'row',
};

const legacyMedia = {
  ImageBlock: 'image',
  ImageCarouselBlock: 'imageCarousel',
  LocalVideoBlock: 'localVideo',
  VideoEmbedBlock: 'videoEmbed',
  SourceCardBlock: 'sourceCard',
};
const legacyGroups = ['LayoutGroupBlock', 'ResearchGroupBlock', 'FreeSizeGroupBlock', 'MediaCompositionBlock'];

function legacyFreeSizeItem(block, groupId, zones) {
  const { id: _blockId, mediaItemId, __galleryImage: _gallery, displayWidth: _width, ...props } = block.props;
  const id = mediaItemId || globalThis.crypto.randomUUID();
  const kind = legacyMedia[block.type];
  if (kind === 'image') return { id, kind, image: props };
  if (kind) return { ...props, id, kind };
  zones[`${groupId}:${freeSizeItemZone(id)}`] = [block];
  return { id, kind: 'component' };
}

export function getPlacementCapabilities(data, targetId, placementZone) {
  const location = findBlockLocation(data, targetId);
  const target = location?.blocks[location.index];
  const incoming = data.zones?.[placementZone] || [];
  const group = ['LayoutGroupBlock', 'ResearchGroupBlock', 'FreeSizeGroupBlock'].includes(target?.type);
  const side = incoming.length > 0 && ['root:left', 'content'].includes(location?.zone)
    && target?.props?.layout !== 'side' && incoming.every((block) => block.props?.layout !== 'side');
  const canGroup = target?.props?.layout !== 'side' && incoming.every((block) => block.props?.layout !== 'side');
  const legacyCompatible = incoming.every((block) => legacyMedia[block.type] || legacyGroups.includes(block.type));
  return { append: group && canGroup && (target.type !== 'FreeSizeGroupBlock' || legacyCompatible), side, canGroup,
    addSide: target?.props?.layout === 'side' && incoming.every((block) => block.props?.layout !== 'side') };

}

export function applyMediaPlacement(data, targetId, placementZone, placement) {
  const location = findBlockLocation(data, targetId);
  const incoming = data.zones?.[placementZone] || [];
  if (!location || !incoming.length) return null;
  const { [placementZone]: _removed, ...zones } = data.zones;
  if (placement === 'append') {
    if (!getPlacementCapabilities(data, targetId, placementZone).append) return null;
    const target = location.blocks[location.index];
    if (target.type === 'FreeSizeGroupBlock') {
      const items = [...(target.props.items || []), ...incoming.map((block) => legacyFreeSizeItem(block, targetId, zones))];
      return replaceCollection({ ...data, zones }, location, (blocks) =>
        blocks.map((block) => block === target ? { ...block, props: { ...block.props, items } } : block));
    }
    const childZone = `${targetId}:items`;
    return { ...data, zones: { ...zones, [childZone]: [...(zones[childZone] || []), ...incoming] } };
  }
  if (placement === 'below-new-group') {
    return replaceCollection({ ...data, zones }, location, (blocks) =>
      [...blocks.slice(0, location.index + 1), ...incoming, ...blocks.slice(location.index + 1)]);
  }

  const capabilities = getPlacementCapabilities(data, targetId, placementZone);
  if (placement === 'side' && capabilities.addSide) {
    const sideZone = `${targetId}:side`;
    return { ...data, zones: { ...zones, [sideZone]: [...(zones[sideZone] || []), ...incoming] } };
  }
  if (placement === 'side' ? !capabilities.side : !capabilities.canGroup) return null;
  const layout = placement === 'side' ? 'side' : layouts[placement];
  if (!layout) return null;
  const id = `LayoutGroupBlock-${globalThis.crypto.randomUUID()}`;
  const group = { type: 'LayoutGroupBlock', props: { id, layout } };
  zones[`${id}:items`] = layout === 'side' ? [location.blocks[location.index]] : [location.blocks[location.index], ...incoming];
  if (layout === 'side') zones[`${id}:side`] = incoming;
  return replaceCollection({ ...data, zones }, location, (blocks) =>
    blocks.map((block, index) => index === location.index ? group : block));
}

export function ungroupLayout(data, id) {
  const location = findBlockLocation(data, id);
  const childZone = `${id}:items`;
  if (!location) return data;
  const { [childZone]: children = [], [`${id}:side`]: side = [], ...zones } = data.zones || {};
  return replaceCollection({ ...data, zones }, location, (blocks) =>
    [...blocks.slice(0, location.index), ...children, ...side, ...blocks.slice(location.index + 1)]);
}

// Removing a group's last anchor also removes the group and its owned drop zones.
export function pruneEmptyGroups(data, ownerZone) {
  const owner = ownerZone?.slice(0, ownerZone.lastIndexOf(':'));
  const location = owner && findBlockLocation(data, owner);
  const group = location?.blocks[location.index];
  const children = data.zones?.[ownerZone] || [];
  const side = data.zones?.[`${owner}:side`] || [];
  if (!group || !['LayoutGroupBlock', 'ResearchGroupBlock'].includes(group.type)
    || ownerZone !== `${owner}:items`) return data;
  if (children.length === 1 && !side.length) {
    const onlyChild = children[0];
    const child = group.props?.displayWidth !== undefined && onlyChild.props?.displayWidth === undefined
      ? { ...onlyChild, props: { ...onlyChild.props, displayWidth: group.props.displayWidth } }
      : onlyChild;
    const { [`${owner}:items`]: _items, [`${owner}:side`]: _side, ...zones } = data.zones || {};
    const collapsed = replaceCollection({ ...data, zones }, location, (blocks) =>
      blocks.map((block) => block === group ? child : block));
    return pruneEmptyGroups(collapsed, location.zone);
  }
  if (children.length) return data;
  const zones = { ...data.zones };
  const removeZones = (id) => {
    for (const key of Object.keys(zones).filter((name) => name.startsWith(`${id}:`))) {
      const children = zones[key];
      delete zones[key];
      children.forEach((child) => removeZones(child.props.id));
    }
  };
  removeZones(owner);
  return pruneEmptyGroups(replaceCollection({ ...data, zones }, location, (blocks) =>
    blocks.filter((block) => block !== group)), location.zone);
}
