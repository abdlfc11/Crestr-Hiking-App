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
    import('../ui/ui-initialisation.ts'),
    import('../ui/ui-context-menu.ts')
  ])

  await initMap();
  initIcons();
  initAuth();
  initSettings();
  initUi();
  initMapContextMenu();
}

document.addEventListener("DOMContentLoaded", initApp);
