//#region IMPORTS

import type Map from "ol/Map.js";

import { addClickListener, showModal } from "../utils/ui-utils.js";

import { getMap } from "../init/map.js";

import { loadAndDisplaySavedPoints } from "../saved_points/index.js";

import { initSaveRoute } from "../routes/index.js";

import { getCurrentMode } from "../routes/routeState.js";

import { initCursor, initCursorManager } from "../cursorManager.js";

import { setOnDistanceUnitChange } from "../settings.js";

import { getTheme } from "../settingsState.js";

import { displaySharedRoute } from "../routes/loadRoute.js";

import { logout } from "../auth/auth.js";

import {
  applyTheme, handleInitialLoadCachedRoute, handleDistanceUnitToggle,
  getClickMode,
  initInteractivePointLayer,
  initRouting
} from "./ui-routing.js";

import {
  initModals,
  showReportIssueModal
} from "./ui-modals.js";


import {
  openSavedRoutesDash, closeSavedRoutesDash, openSettings, closeSettings,
  openImportRoute, closeImportRoute,
  cancelRouteImport
} from "./ui-panels.js";

import { initImportRoutePanel } from "../importRoute.js";
import { initMobile } from "./ui-mobile.js";
import { handleInitialTour } from "./ui-tours.js";
import { checkForUpdate } from "./ui-updates.js";


// Nav Rail

function initNavRail() {

  const reportIssueOpenButton = document.getElementById("report-issues-open-button");

  const shortcutsModalOpenButton = document.getElementById("sidenav-shortcuts-button");
  const shortcutsModal = document.getElementById('shortcuts-dialog') as HTMLDialogElement | null;

  const loginNavBarButton = document.getElementById("sidenav-login-button");
  const logoutNavBarButton = document.getElementById("sidenav-logout-button");

  const openSavedRoutesDashButton = document.getElementById("saved-routes-dash-open-button");
  const closeSavedRoutesDashButton = document.getElementById("saved-routes-dash-go-back-button");

  const settingOpenButton = document.getElementById("settings-open-button");
  const settingCloseButton = document.getElementById("settings-close-button");

  const importRouteOpenButton = document.getElementById("import-route-open-button");
  const importRouteCloseButton = document.getElementById("import-route-close-button");
  const importRouteCancelButton = document.getElementById("import-route-cancel-button");

  // Event Listeners
  addClickListener(openSavedRoutesDashButton, openSavedRoutesDash, "click");
  addClickListener(closeSavedRoutesDashButton, closeSavedRoutesDash, "click");

  addClickListener(settingOpenButton, openSettings, "click");
  addClickListener(settingCloseButton, closeSettings, "click");

  addClickListener(importRouteOpenButton, openImportRoute, "click");
  addClickListener(importRouteCloseButton, closeImportRoute, "click");
  addClickListener(importRouteCancelButton, cancelRouteImport, "click");

  addClickListener(loginNavBarButton, () => window.location.href = "/login-page", 'click')
  addClickListener(logoutNavBarButton, logout, 'click')

  addClickListener(reportIssueOpenButton, () => showReportIssueModal(true), "click");
  addClickListener(shortcutsModalOpenButton, () => showModal(true, shortcutsModal), "click");
}



// Initialisation

function initSavedPoints(map: Map) {
  initInteractivePointLayer(map);
  loadAndDisplaySavedPoints();
}

function initSharedRoute() {
  const routeId = new URLSearchParams(window.location.search).get("route_id");
  if (routeId) displaySharedRoute(routeId);
}

export function initUi() {
  const map = getMap();

  if (map) {
    initCursorManager(map, getCurrentMode, getClickMode);
  }

  applyTheme(getTheme());

  initSaveRoute();
  initModals();
  initNavRail();
  initMobile();
  initImportRoutePanel();
  initRouting();
  initCursor();
  initSavedPoints(map);

  // Detects previous access
  const hasAccessedApp = localStorage.getItem("hasAccessedApp") === 'true' || localStorage.getItem("seenInitialTour") === 'true';

  // initial tour (automatic routing and saving the first route)
  handleInitialTour();

  // shows modal to load previous route if prompted to login after attempted save route
  handleInitialLoadCachedRoute()

  // These event listeners are for settings and preferences.
  setOnDistanceUnitChange(() => handleDistanceUnitToggle());

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme(getTheme());
  });

  initSharedRoute();
  checkForUpdate(hasAccessedApp);
}


//#endregion
