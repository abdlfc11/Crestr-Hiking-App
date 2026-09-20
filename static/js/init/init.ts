async function initApp() {
  const [
    { initMap },
    { initIcons }, 
    { initAuth },
    { initSettings },
    { initUi }, 
    { initMapContextMenu }
  ] = await Promise.all([
    import('./map.ts'),
    import('./icons.ts'),
    import("../auth/auth.ts"),
    import("../settings.ts"),
    import('../ui/ui.ts'),
    import('../ui/map-context-menu.ts')
  ])

  initMap();
  initIcons();
  initAuth();
  initSettings();
  initUi();
  initMapContextMenu();
}

document.addEventListener("DOMContentLoaded", initApp);
