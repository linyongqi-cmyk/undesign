let componentClipboard = null;

const clone = (value) => JSON.parse(JSON.stringify(value));

function zoneContent(data, zone) {
  return zone === 'root' ? data?.content : data?.zones?.[zone];
}

export function copyPuckComponent(data, selector) {
  if (!selector || !Number.isInteger(Number(selector.index))) return null;
  const zone = selector.zone || 'root';
  const component = zoneContent(data, zone)?.[Number(selector.index)];
  if (!component?.props?.id) return null;

  const zones = {};
  const collectZones = (item) => {
    const id = item?.props?.id;
    if (!id) return;
    const prefix = `${id}:`;
    for (const [zoneKey, contents] of Object.entries(data.zones || {})) {
      if (!zoneKey.startsWith(prefix)) continue;
      zones[zoneKey] = clone(contents || []);
      for (const child of contents || []) collectZones(child);
    }
  };
  collectZones(component);
  return { component: clone(component), zones };
}

export function pastePuckComponent(data, selector, clipboard, fallbackZone = 'root', createId = () => crypto.randomUUID()) {
  if (!clipboard?.component?.type || !clipboard.component.props?.id) return null;

  const selectedZone = selector?.zone || 'root';
  const selectedIndex = Number(selector?.index);
  const hasSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0 && zoneContent(data, selectedZone)?.[selectedIndex];
  const destinationZone = hasSelection ? selectedZone : fallbackZone;
  const destinationContent = zoneContent(data, destinationZone);
  if (!Array.isArray(destinationContent)) return null;
  const destinationIndex = hasSelection ? selectedIndex + 1 : destinationContent.length;

  const newZones = {};
  const copyBlockWithNewIds = (block) => {
    const oldId = block.props.id;
    const newId = createId(block.type);
    const copiedBlock = { ...clone(block), props: { ...clone(block.props), id: newId } };
    const prefix = `${oldId}:`;
    for (const [zoneKey, children] of Object.entries(clipboard.zones || {})) {
      if (!zoneKey.startsWith(prefix)) continue;
      const newZoneKey = `${newId}:${zoneKey.slice(prefix.length)}`;
      newZones[newZoneKey] = (children || []).map(copyBlockWithNewIds);
    }
    return copiedBlock;
  };

  const component = copyBlockWithNewIds(clipboard.component);
  const nextContent = [...destinationContent];
  nextContent.splice(destinationIndex, 0, component);
  const nextData = destinationZone === 'root'
    ? { ...data, content: nextContent, zones: { ...(data.zones || {}), ...newZones } }
    : { ...data, zones: { ...(data.zones || {}), [destinationZone]: nextContent, ...newZones } };

  return { data: nextData, selector: { zone: destinationZone, index: destinationIndex } };
}

export function setComponentClipboard(clipboard) {
  componentClipboard = clipboard ? clone(clipboard) : null;
}

export function getComponentClipboard() {
  return componentClipboard ? clone(componentClipboard) : null;
}
