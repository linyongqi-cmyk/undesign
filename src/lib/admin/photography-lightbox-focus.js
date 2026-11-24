export function resolvePhotographyLightboxFocusTarget(imageEditor, trigger) {
  const settingsButton = imageEditor?.querySelector?.('.puck-component-settings');
  return settingsButton?.isConnected ? settingsButton : trigger;
}
