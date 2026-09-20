export { initSaveRoute } from "./saveRoute.js";
export {
  deleteRoute,
  loadRoute,
  downloadRoute,
} from "./routeApi.js";
// Dashboard exports live in savedRoutesDashboard.ts — import from there on the map page only.
export {
  getCurrentMode,
  setCurrentMode,
  getCurrentPathData,
  setCurrentPathData,
  getLoadedRouteCoordinates,
  setLoadedRouteCoordinates,
  clearPathState,
  clearManualRouteState,
  manualRouteState,
} from "./routeState.js";
