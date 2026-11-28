// Lucide standard 24x24 icon paths (custom layout icons kept for width/size/spacing/caption)
export const adminActionPaths = {
  up: 'm5 12 7-7 7 7M12 19V5',
  down: 'M12 5v14m7-7-7 7-7-7',
  add: 'M5 12h14M12 5v14',
  replace: 'M8 3 4 7l4 4M4 7h16m-4 14 4-4-4-4m4 4H4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7-5-5-5 5m5-5v12',
  indent: 'M21 12H11m10-6H11m10 12H11M3 8l4 4-4 4',
  order: 'M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13',
  group: 'M3 7V5c0-1.1.9-2 2-2h2m10 0h2c1.1 0 2 .9 2 2v2m0 10v2c0 1.1-.9 2-2 2h-2M7 21H5c-1.1 0-2-.9-2-2v-2M7 7h6v5H7zm4 5h6v5h-6z',
  ungroup: 'M4 4h8v6H4zm8 10h8v6h-8z',
  delete: 'M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6',
  edit: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  width: 'M12 12h.01M16 12h.01m1-5 5 5-5 5M7 7l-5 5 5 5m1-5h.01',
  size: 'M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0',
  spacing: 'M4 4h16M4 20h16M12 7v10m-3-7 3-3 3 3m-6 4 3 3 3-3',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
  zoomIn: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm10 18-4.35-4.35M11 8v6m-3-3h6',
  link: 'M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2M8 12h8',
  caption: 'M16 5H3m8 7H3m13 7H3m15-10v6m3-3h-6',
  save: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7',
  close: 'M18 6 6 18M6 6l12 12',
};

export function adminActionIcon(name) {
  const extra = name === 'settings' ? '<circle cx="12" cy="12" r="3" />' : name === 'size' ? '<circle cx="12" cy="12" r="1" />' : '';
  return `<svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${adminActionPaths[name]}" />${extra}</svg>`;
}
