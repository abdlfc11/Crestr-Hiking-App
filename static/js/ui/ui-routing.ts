

// Imports

// Open Layers Imports
import { toLonLat, fromLonLat } from "ol/proj.js";
import { Point, LineString } from "ol/geom.js"
import VectorSource from "ol/source/Vector.js";
import VectorLayer from "ol/layer/Vector.js";
import Feature from "ol/Feature.js";
import { Translate } from "ol/interaction.js"
import PointerInteraction from "ol/interaction/Pointer.js";
import type Map from "ol/Map.js";
import type MapBrowserEvent from "ol/MapBrowserEvent.js";
import type Style from "ol/style/Style.js";

// LocalForage
import localforage from "localforage";

// Local Imports
import { MAP_VIEW_PADDING, isMobileOrTablet } from "../constants.js";

// Helper Imports
import { formatLatLon } from "../utils/routing-utils.js";

import {
  createManualPointStyle,
  createRouteHoverPointStyle
} from "../utils/style-utils.js";

import {
  formatDistance,
  formatETA,
  formatElevation
} from "../utils/format-utils.js";

import {
  showToast,
  createStatsPanel,
  parseCoordString,
  showModal,
  closeModals,
  addClickListener
} from "../utils/ui-utils.js";

import { moveMapToPosition } from "../utils/map-utils.js";

// Routing  Imports
import {
  addManualPoint,
  replaceIntermediaryPoint,
  insertIntermediaryPoint,
  getManualRouteSegmentIndex
} from "../routing/index.js";

import {
  getMap,
  getRouteLayer,
  getManualRouteLayer,
  removeManualRouteLayer,
  onMapClick
} from "../init/map.js";

import {
  loadAndDisplaySavedPoints,
  getSavedPointsLayer
} from "../saved_points/index.js";

import {
  getSavedPointStyle,
  getSelectedPointStyle,
} from "../saved_points/style.js";

import {
  getCurrentMode,
  getCurrentPathData,
  getLoadedRouteCoordinates,
  clearPathState,
  clearManualRouteState,
  manualRouteState,
  setLastKnownDistanceKm,
  getLastAutoRouteStats,
  getLastLoadedRouteStats,
  clearLastAutoRouteStats,
  clearLastLoadedRouteStats,
  isPointInPolygon,
} from "../routes/routeState.js";

import { displayLoadedRouteStats } from "../routes/loadRoute.js";

// Cursor imports
import {
  updateCursor,
  setCursor
} from "../cursorManager.js";

// Elevation Profile Imports
import {
  createElevationProfile,
  initChartToggleListener,
  resetElevationChart,
  toggleElevationChart
} from "../elevationChart.js";

// Error Helper Imports

import { logError } from "../utils/logError-utils.js";
import { ERROR_MESSAGES } from "../utils/error-constants.js";

// Modal / Panel Imports
import {
  populateLastLoadedRouteModal
} from "./ui-modals.js";

import {
  closePanels, closeSavedRoutesDash, toggleSaveRouteContainer,
  collapseSaveRouteContainer, updateSaveRouteContainer
} from "./ui-panels.js";


// Variable / Constant Declarations

const startCoordEntry = document.getElementById("start-point-entry") as HTMLInputElement | null;
const endCoordEntry = document.getElementById("end-point-entry") as HTMLInputElement | null;
const setStartCoordButton = document.getElementById("set-start-coord-button");
const setEndCoordButton = document.getElementById("set-end-coord-button");

const searchForAreaButton = document.getElementById("search-for-area-button");
const searchEntry = document.getElementById("search-entry") as HTMLInputElement | null;

const routeNameEntry = document.getElementById("route-name") as HTMLInputElement | null;
const saveContainer = document.getElementById('save-route-container');
const saveRouteContainer = document.getElementById('save-route-container');
const mobileSaveRouteContainer = document.getElementById('mobile-save-route-container');
const saveRouteToggleButton = document.getElementById("save-route-toggle-button");
const noRouteCardButton = document.getElementById("no-route-create-button");

const deletePointModal = document.getElementById("delete-point-confirmation-dialog") as HTMLDialogElement | null;
const deletePointModalNameDisplay = document.getElementById("point-name-display");

const homeButton = document.getElementById("home-button");
const clearRouteButton = document.getElementById("clear-route-button");
const undoManualRouteButton = document.getElementById("undo-manual-route");
const redoManualRouteButton = document.getElementById("redo-manual-route");
const generatePathButton = document.getElementById("generate-path-button") as HTMLButtonElement | null;

type ClickMode = "setStart" | "setEnd" | null;
type PointType = "start" | "end" | "start-end" | "route-waypoint";
let clickMode: ClickMode = null;
export let selectedPoint: Feature<Point> | null = null;
let manualRouteFeature: Feature<LineString> | null = null;
let interactivePointLayerInteraction: Translate | null = null; // holds the OpenLayer interaction for the start and end points
let interactivePointLayer: VectorLayer<VectorSource> | null = null; // stores the vector layer which holds the point features

// Waypoint insertion interaction

let routeLineIsDragging = false;
let routeLineDragInteraction: PointerInteraction | null = null;
let routeHoverFeature: Feature<Point> | null = null;
let lastMousePosition: number[] | null = null;
let lastMouseID: number | null = null;
let mousePositionThreshold: number = 5; // in pixels
let closestSegmentIndex: number | null = null;
const loadLastRouteModal = document.getElementById('load-last-route-dialog') as HTMLDialogElement | null;

//#endregion

// Helper Function
export function getManualRouteFeature(): Feature<LineString> | null {
  return manualRouteFeature
}

// Map click handler

export async function manualRouteClickHandler(event: MapBrowserEvent<PointerEvent>) {

  if (handleSelectSavedPoint(event)) return;
  resetCoordInputState(false)

  generatePathButton.disabled = true;
  generatePathButton.classList.add('loading');

  setCoordInputActiveState(startCoordEntry, false);
  setCoordInputActiveState(endCoordEntry, false);

  try {
    const coordinate = event.coordinate;

    const lonLat = toLonLat(coordinate);
    if (!isPointInPolygon(lonLat)) throw new Error("manualRouteClickHandler() : User attempting to plot point outside UK", {cause : ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION});

    const type = clickMode === "setStart"
      ? "start"
      : clickMode === "setEnd"
        ? "end"
        : "normal";

    if (type === "end" && manualRouteState.userClicks.length === 0) throw new Error("Start point required", { cause: "Set a start point before setting the end point." });

    if (manualRouteState.userClicks.length === 0) clearAutoRoute();

    const response = await addManualPoint(coordinate[0], coordinate[1], type);

    // This checks success status
    if (!response || !response.success) throw new Error(response?.message || "Error : manualRouteClickHandler()");

    clickMode = null;
    syncCoordinateInputs();
    updateCursor();
  } catch (error) {
    if (error.cause) {
      console.error(error);
      showToast(error.cause, "error", null);
    }
    else {
      showToast(ERROR_MESSAGES.ROUTING.NO_PATH_FOUND, "error", null);
      logError("Calculating Path", error.message || "Manual Route", null, "NO_PATH_FOUND");
    }
    return;
  }
  finally {
    generatePathButton.disabled = false;
    generatePathButton.classList.remove('loading');
  }
}


export async function handleInitialLoadCachedRoute() {
  const hasPreviousSaveAttempt = await localforage.getItem('unauthenticated-save-route-attempt')
  const routeName = await localforage.getItem<string>('cachedRouteName');

  if (!hasPreviousSaveAttempt || !window.appConfig.loggedIn) return;

  const routeStats = await localforage.getItem<RouteStats>('cachedManualRouteStats');
  if (!routeStats) {
    throw new Error(
      "ERROR (handleInitialLoadCachedRoute()) : Could not retrieve route stats",
      {cause : "Sorry, there was an unexpected error loading the route."}
    );
  };

  populateLastLoadedRouteModal(routeStats, routeName ?? "");
  showModal(true, loadLastRouteModal);

}

//#endregion
//#region COORDINATE INPUT FUNCTIONS

export function isCoordInputEmpty(startPoint: string, endPoint: string): boolean {

  if (endPoint === "" && startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return true;
  }

  if (startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    return true;
  }

  if (endPoint === "") {
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return true;
  }

  return false;
};

export function validateInputCoords(startPoint: string, endPoint: string): boolean {

  if (isCoordInputEmpty(startPoint, endPoint)) {
    return false;
  }

  // This splits the string via commas
  const startParts = startPoint.split(",");
  const endParts = endPoint.split(",");

  // This ensures there are two coordinates
  if (startParts.length < 2 || endParts.length < 2) {
    showToast("Invalid coordinate format. Please Use Lat, Lon");
    return false;
  }

  // this parses the full string into numbers
  const startLat = parseFloat(startParts[0].trim());
  const startLon = parseFloat(startParts[1].trim());
  const endLat = parseFloat(endParts[0].trim());
  const endLon = parseFloat(endParts[1].trim());

  // this re-orders coordinates to [lon, lat] for the Cumbria ray-casting check (array of Cumbria boundary has coords in [lon, lat] format)
  const startLonLat = [startLon, startLat];
  const endLonLat = [endLon, endLat];

  if ( !isPointInPolygon(startLonLat)) {
    showToast(ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION)
    startCoordEntry.value = '';
    showCoordInputError(startCoordEntry, ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION);
    return false
  }

  if (!isPointInPolygon(endLonLat)) {
    showToast(ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION);
    endCoordEntry.value = ''
    showCoordInputError(endCoordEntry, ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION);
    return false;
  }

  return true;
};

export function showCoordInputError(entry: HTMLInputElement, message: string) {
  entry.placeholder = message;
  entry.classList.add("input-error");
  entry.addEventListener(
    "input",
    () => {
      entry.classList.remove("input-error");
      entry.placeholder = "Coordinates";
    },
    { once: true },
  );
}

export function setCoordInputActiveState(entry: HTMLInputElement, isActive: boolean) {
  entry.classList.toggle("is-active", isActive);
}

export function setStartCoord() {
  clickMode = "setStart";
  setCoordInputActiveState(startCoordEntry, true);
  setCoordInputActiveState(endCoordEntry, false);
  startCoordEntry.placeholder = "Click a point on the map";
  updateCursor();
}

export function setEndCoord() {
  clickMode = "setEnd";
  setCoordInputActiveState(startCoordEntry, false);
  setCoordInputActiveState(endCoordEntry, true);
  endCoordEntry.placeholder = "Click a point on the map";
  updateCursor();
}

/**
 * Updates the start and end point entries relative to manualRouteState.userClicks
 */
export function syncCoordinateInputs() {
  const { userClicks } = manualRouteState;

  startCoordEntry.value = userClicks.length > 0 ? formatLatLon(toLonLat(userClicks[0]), 6) : "";
  endCoordEntry.value = userClicks.length > 1 ? formatLatLon(toLonLat(userClicks[userClicks.length - 1]), 6) : "";
}

//#endregion

export function getClickMode() {
  return clickMode;
}

//#endregion
//#region CLEARING INPUTS

export function clearAutoRoute() {
  const map = getMap();
  if (!map) return;

  clearPathState();
  clearLastAutoRouteStats();

  // this clears the permanent route layer
  getRouteLayer()?.getSource()?.clear();

  // this clears start / end markers from the interactive layer
  if (interactivePointLayer) {
    const source = interactivePointLayer.getSource();
    source.getFeatures()
      .filter(f => f.get("type") === "start" || f.get("type") === "end")
      .forEach(f => source.removeFeature(f));
  }

  // this clears any other temporary vector layers (but leaves saved-points + interactive + route alone)
  map.getLayers().getArray().slice().forEach((layer) => {
    if (
      layer instanceof VectorLayer &&
      layer !== getSavedPointsLayer() &&
      layer !== getRouteLayer() &&
      layer !== interactivePointLayer
    ) {
      layer.getSource()?.clear();
    }
  });

  // this cleans up the UI
  document.getElementById("route-stats")?.remove();
  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveContainer) saveContainer.style.display = "none";
  if (mobileSaveRouteContainer.classList.contains("show")) mobileSaveRouteContainer.classList.remove("show");
  updateSaveRouteContainer();

}

export function clearManualRoute() {
  const map = getMap();
  if (!map) return;

  resetCoordInputState()
  clearManualRouteState();
  removeManualRouteLayer();
  manualRouteFeature = null;

  if (interactivePointLayer) {
    interactivePointLayer.getSource().clear();
  }

  // this also clears the permanent route layer (in case anything was drawn there)
  getRouteLayer()?.getSource()?.clear();

  document.getElementById("route-stats")?.remove();
  if (saveContainer) saveContainer.style.display = "none";
  if (mobileSaveRouteContainer.classList.contains("show")) mobileSaveRouteContainer.classList.remove("show");
  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  updateSaveRouteContainer();
  resetElevationChart();
}

export function resetCoordInputState(clearValues = true) {
  if (startCoordEntry) {
    startCoordEntry.classList.remove("input-error", "is-active");
    startCoordEntry.placeholder = "Coordinates";
    if (clearValues) startCoordEntry.value = "";
  }
  if (endCoordEntry) {
    endCoordEntry.classList.remove("input-error", "is-active");
    endCoordEntry.placeholder = "Coordinates";
    if (clearValues) endCoordEntry.value = "";
  }
}

export function homeButtonFunction() {
  const map = getMap();
  if (!map) return;

  // closes any modals / panels to return to the map view
  closeModals();
  closePanels();
  resetCoordInputState(false);

  if (map.getView().getAnimating()) {
    return;
  }

  clickMode = null;
  generatePathButton?.classList.remove("loading");

  // this wipes all route-related state
  clearManualRoute();
  clearAutoRoute();
  clearLastLoadedRouteStats();
  clearPathState();

  // Remove only temporary vector layers.
  // Keep: routeLayer, interactivePointLayer, saved-points layer
  map.getLayers().getArray().slice().forEach((layer) => {
    if (
      layer instanceof VectorLayer &&
      layer !== getRouteLayer() &&
      layer !== interactivePointLayer &&
      layer !== getSavedPointsLayer()
    ) {
      map.removeLayer(layer);
    }
  });

  // this cleans up the UI
  document.getElementById("route-stats")?.remove();
  if (searchEntry) searchEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveContainer) saveContainer.style.display = "none";
  if (mobileSaveRouteContainer.classList.contains("show")) mobileSaveRouteContainer.classList.remove("show");
  updateSaveRouteContainer();

  // this resets the map view and re-shows saved points
  loadAndDisplaySavedPoints();
  map.renderSync(); // this is to ensure that the map renders the deletion of the routeLayer features before the moving of the map view

  moveMapToPosition(map);
  updateCursor();
}

//#endregion
//#region SEARCHING FUNCTION

/**
 * Responsible for moving to a given location
 */
export async function searchArea() {

  const map = getMap();
  if (!map) return;

  try {
    if (!searchEntry) {
      throw new Error("ERROR in searchArea() : Search Entry not found", {cause : ERROR_MESSAGES.SEARCH.GENERIC});
    };

    const searchValue = searchEntry.value.trim();

    if (!searchValue) throw new Error("ERROR in searchArea() : searchValue is empty", {cause : "Please enter a location. "})

    const response = await fetch(window.appConfig.apiSearchAreaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search_input: searchValue }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ERROR IN searchArea(): ${response.status}`, {cause : data.user_message || ERROR_MESSAGES.SEARCH.GENERIC});
    };

    if (!data.success) {
      throw new Error(data.message || "Error in searchArea()", {cause : data.user_message || ERROR_MESSAGES.SEARCH.GENERIC});
    };

    const view = map.getView();

    const searchCenter = fromLonLat(data.coordinates);

    view.animate({
      center: searchCenter,
      zoom: 14,
      duration: 1500,
    });
    searchEntry.value = '';
  } catch (error) {
    showToast(error.cause || ERROR_MESSAGES.SEARCH.GENERIC);
  };
};

//#endregion
//#region CACHED ROUTES

export async function handleLoadCachedRoute() {
  if (loadLastRouteModal) showModal(false, loadLastRouteModal); // hides modal

  try {
    await handleLoadManualCachedRoute()
    await localforage.clear();
  }
  catch(error) {
    showToast("There was an error loading your last route", "error", null);
    throw new Error(error.message)
  }
}

export async function handleLoadManualCachedRoute() {

  const map = getMap();

  const [userClicks, pathCoords, segmentCache, isSnapped] = await Promise.all([
    localforage.getItem("cachedUserClicks"),
    localforage.getItem("cachedPathCoords"),
    localforage.getItem("cachedSegmentCache"),
    localforage.getItem("cachedRouteIsSnapped")
  ]);

  if (!Array.isArray(userClicks) || !Array.isArray(pathCoords) || !segmentCache || typeof segmentCache !== "object") {
    throw new Error("Cached manual route is incomplete");
  }

  manualRouteState.userClicks = userClicks;
  manualRouteState.pathCoords = pathCoords;
  manualRouteState.segmentCache = segmentCache as Record<string, number[][]>;
  manualRouteState.isSnapped = Boolean(isSnapped);
  manualRouteState.redoStack = [];
  manualRouteFeature = null;
  removeManualRouteLayer();
  await updateManualRoute();
  syncCoordinateInputs();

  const manualRouteLayer = getManualRouteLayer();
  if (pathCoords.length > 0) {
    setTimeout(() => {
      getMap()?.getView().fit(manualRouteLayer.getSource().getExtent(), {
        padding: MAP_VIEW_PADDING,
        duration: 1200,
      });
    }, 50);

    map.renderSync();
  }
}

//#endregion
//#region MANUAL ROUTING

/**
 * Creates a manual route with a given start and end point
 */
export async function handleManualRouteGeneration(start: string | null = null, end: string | null = null) {

  const startPoint = start || startCoordEntry?.value || "";
  const endPoint = end || endCoordEntry?.value || "";

  if (!validateInputCoords(startPoint, endPoint)) return;

  const parsedStart = parseCoordString(startPoint);
  const parsedEnd = parseCoordString(endPoint);
  const startMercator = toWebMercator(parsedStart);
  const endMercator = toWebMercator(parsedEnd);

  if (!startMercator || !endMercator) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  try {
    clearManualRoute();
    await localforage.setItem("lastRoutingMode", "manual");

    await addManualPoint(startMercator[0], startMercator[1]);
    await addManualPoint(endMercator[0], endMercator[1]);

    syncCoordinateInputs();
  }
  catch (error) {
    clearManualRoute();
    showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
  }
  finally {
    generatePathButton.disabled = false;
    generatePathButton.classList.remove("loading");
  }
}

/**
 * Handles the clearing of route stats and save button if there are no current coordinates
 */
export function cleanRouteUI() {
  document.getElementById("route-stats")?.remove();
  resetElevationChart();
  if (saveRouteContainer && getCurrentMode() === "manual") {
    saveRouteContainer.style.display = "none";
    collapseSaveRouteContainer();
  }
  if (mobileSaveRouteContainer.classList.contains("show")) mobileSaveRouteContainer.classList.remove("show");
};

/**
 * Updates key point features, such as start, end and intermediary points
 */
export function syncManualEndpointMarkers(userClicks: number[][]) {
  if (!interactivePointLayer) return;
  const source = interactivePointLayer.getSource();

  source.clear();

  if (userClicks.length === 0) return;

  const isClosed = manualRouteState.isSnapped


  const startPointFeature = createPoint(
    userClicks[0],
    getSavedPointStyle(isClosed ? "Start/End" : "Start", "#00A86B"),
    isClosed ? "start-end" : "start",
    isClosed ? "Start/End" : "Start"
  );

  addStartEndPoint(
    startPointFeature,
    interactivePointLayer,
    isClosed ? "start-end" : "start"
  );


  if (userClicks.length >= 2 && !isClosed) {

    const endPointFeature = createPoint(
      userClicks[userClicks.length - 1],
      getSavedPointStyle("End", "#D32F2F"),
      "end",
      "End"
    )

    addStartEndPoint(
      endPointFeature,
      interactivePointLayer,
      "end"
    );
  }

  // This adds intermediary points (if there are any)
  for (let i = 1; i < userClicks.length - 1; i++) {

    const intermediaryPointFeature = createPoint(
      userClicks[i],
      createManualPointStyle(),
      "route-waypoint",
      undefined,
      i
    );

    addStartEndPoint(
      intermediaryPointFeature,
      interactivePointLayer,
      "route-waypoint"
    );
  }

  setUpPointInteraction([interactivePointLayer]);
}

export async function updateManualRoute() {
  const map = getMap();
  if (!map) return;

  let manualRouteLayer = getManualRouteLayer();

  try {

    const { userClicks, pathCoords } = manualRouteState;
    syncManualEndpointMarkers(userClicks);


    if (userClicks.length === 0) {
      cleanRouteUI();
      return;
    } else {
      isMobileOrTablet ? mobileSaveRouteContainer.classList.add("show") : saveContainer.style.display = "flex";
    }

    if (pathCoords.length > 1) {
      if (!manualRouteFeature) {
        manualRouteFeature = new Feature({
          geometry: new LineString(pathCoords),
          type: "line",
        });

        manualRouteLayer.getSource().addFeature(manualRouteFeature);
      } else {
        manualRouteFeature.getGeometry().setCoordinates(pathCoords);
      }
    } else {
      if (manualRouteFeature) {
        manualRouteLayer.getSource().removeFeature(manualRouteFeature);
        manualRouteFeature = null;
      }
    }

    if (pathCoords.length === 1) {
      setLastKnownDistanceKm(0);
      updateManualRouteStats(true, formatDistance(0), formatETA(0), formatElevation(0));
      resetElevationChart();
      if (!window.appConfig.loggedIn) {
        await localforage.setItem("cachedUserClicks", userClicks);
        await localforage.setItem("cachedPathCoords", pathCoords);
        await localforage.setItem("cachedManualRouteStats", {
          total_distance: 0,
          eta_seconds: 0,
          elevation_gain: 0
        });
      }
      return;
    }

    const transformedPathCoords = pathCoords.map(coord => {
      const [lon, lat] = toLonLat(coord);

      return coord.length === 3 ? [lon, lat, coord[2]] : [lon, lat]
    });

    const routeStatsResponse = await fetch(window.appConfig.apiNormaliseRouteStatsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: transformedPathCoords
      }),
    });

    const routeStats = await routeStatsResponse.json().catch(() => ({}));

    if (
      !routeStatsResponse.ok ||
      !Number.isFinite(Number(routeStats.distance_km)) ||
      !Number.isFinite(Number(routeStats.eta_seconds)) ||
      !Number.isFinite(Number(routeStats.elevation_gain_m))
    ) {
      throw new Error(routeStats.message || "ERROR : updateManualRoute()", {cause : routeStats.user_message || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED})
    };

    // sets the source of truth for distance values
    setLastKnownDistanceKm(routeStats.distance_km);


    // sets display values
    const distanceDisplay = formatDistance(routeStats.distance_km);
    const etaDisplay = formatETA(routeStats.eta_seconds);
    const elevationGainDisplay = formatElevation(routeStats.elevation_gain_m);


    // caches route info if not logged in, used to allow user to continue routing if they login
    if (!window.appConfig.loggedIn) {
      await localforage.setItem('cachedUserClicks', userClicks);
      await localforage.setItem('cachedPathCoords', pathCoords);
      await localforage.setItem('cachedManualRouteStats', {
        total_distance: Number(routeStats.distance_km),
        eta_seconds: Number(routeStats.eta_seconds),
        elevation_gain: Number(routeStats.elevation_gain_m)
      });
    }

    const isOnePoint = pathCoords.length === 1;

    updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay);
    createElevationProfile(pathCoords);

  }
  catch (error) {
    throw new Error(error.message || "ERROR : updateManualRoute()", {cause : error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED});
  }
};

export function updateManualRouteStats(
  isOnePoint: boolean,
  distanceDisplay: string,
  etaDisplay: string,
  elevationGainDisplay: string,
) {
  let statsDiv = document.getElementById("route-stats");
  let firstRender = !statsDiv

  if (firstRender) {

    statsDiv = document.createElement("div");
    statsDiv.id = "route-stats";
    document.body.appendChild(statsDiv);

    statsDiv.innerHTML = createStatsPanel(distanceDisplay, etaDisplay, elevationGainDisplay);

    initChartToggleListener();
  }
  else {
    document.getElementById("route-distance-display").textContent = distanceDisplay;
    document.getElementById("route-eta-display").textContent = etaDisplay;
    document.getElementById("route-elevation-gain-display").textContent = elevationGainDisplay;
  }

  const toggleChartButton = document.getElementById('toggle-elevation-chart') as HTMLButtonElement | null;

  if (toggleChartButton) {
    toggleChartButton.classList.toggle('one-point-only', isOnePoint);
    toggleChartButton.disabled = isOnePoint;
  }
}

export async function undoManualRoutePoint() {

  const { userClicks } = manualRouteState;

  // guard clause to prevent redundant running of code if userClicks is none / has no coords
  if (!userClicks || userClicks.length === 0) {
    if (saveContainer) saveContainer.style.display = 'none';
    document.getElementById('route-stats')?.remove();
    resetElevationChart();
    collapseSaveRouteContainer();
    await updateManualRoute();
    syncCoordinateInputs();
    return;
  }

  // this removes the last click
  const removed = userClicks.pop();
  manualRouteState.isSnapped = false;

  // this adds the removed point to the redo stack
  manualRouteState.redoStack.push(removed);

  manualRouteState.pathCoords = []; // resets pathCoord array

  // this updates the UI and exits if there are no clicks
  if (userClicks.length === 0) {
    await updateManualRoute();
    syncCoordinateInputs();
    return;
  }

  // this pushes the first click
  manualRouteState.pathCoords.push(userClicks[0]);

  // this rebuilds the pathCoords array
  for (let i = 0; i < userClicks.length - 1; i++) {
    const A = userClicks[i];
    const B = userClicks[i + 1];

    const key = JSON.stringify([A, B]);
    const segment = manualRouteState.segmentCache[key]; // retrieves route segment already calculated from cache

    if (!segment) {
      console.error("Missing cache segment for :", A, B)
      continue;
    }

    // this pushes everything except the first point to avoid duplication of points
    manualRouteState.pathCoords.push(...segment.slice(1));
  }

  // this updates the UI
  await updateManualRoute();
  syncCoordinateInputs();
};

export async function redoManualRoutePoint() {
  const restoredPoint = manualRouteState.redoStack.pop();

  if (!restoredPoint) return;

  try {
    await addManualPoint(restoredPoint[0], restoredPoint[1], "normal", { clearRedo: false });
    syncCoordinateInputs();
  } catch (error) {
    manualRouteState.redoStack.push(restoredPoint);
    showToast(error.cause || "Sorry, we couldn't redo your point.", "error", null);
  }
};

//#endregion

//#region POINT INTERACTION

/**
 * Converts a human-entered [latitude, longitude] pair into Web Mercator (EPSG: 3857) coords for OpenLayers
 */
export function toWebMercator(latLon: number[] | null): number[] | null {
  if (!latLon || latLon.length < 2) return null;

  // OpenLayers expects [longitude, latitude]
  return fromLonLat([latLon[1], latLon[0]]);
}

/**
 * Handles a change on either the start or end coordinate input.
 */
export async function handleCoordEntryChange(entry: HTMLInputElement, type: "start" | "end") {
  const raw = entry?.value?.trim() ?? "";
  const parsed = parseCoordString(raw);

  // this returns if the string is in an invalid format
  if (!parsed) return;

  // this converts coords to Web Mercator when the value is lon/lat
  const mercatorCoords = toWebMercator(parsed);
  if (!mercatorCoords) return;

  // returning prematurely if the point is not in Cumbria
  if (!isPointInPolygon(toLonLat(mercatorCoords))) {
    showToast(ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION)
    return;
  }

  const map = getMap();
  map.renderSync();

  try {
    if (type === "end") {

      const startMercatorCoords = toWebMercator(parseCoordString(startCoordEntry?.value?.trim()));

      if (
        startMercatorCoords &&
        mercatorCoords[0] === startMercatorCoords[0] &&
        mercatorCoords[1] === startMercatorCoords[1]
      ) {
        showToast("Please enter a different coordinate to the start point. ", "error", null);
        entry.value = "";
        return;
      }

      if (manualRouteState.userClicks.length === 0) {
        showToast("Set a start point before setting the end point.", "error");
        entry.value = "";
        return;
      }
    }

    await addManualPoint(mercatorCoords[0], mercatorCoords[1], type);
    syncCoordinateInputs();
  } catch (error) {
    syncCoordinateInputs();
    showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
  }
}

/**
 * Adds a start/end point feature to a vector layer, removing any existing feature of the same type first
 */
export function addStartEndPoint(pointFeature: Feature<Point>, vectorLayer: VectorLayer<VectorSource>, type: PointType,) {
  const vectorLayerSource = vectorLayer.getSource();

  // this removes any existing features which are of the same type (for start and end points)
  if (type !== "route-waypoint") {
    vectorLayerSource.getFeatures()
      .filter(feature => feature.get('type') === type)
      .forEach(feature => vectorLayerSource.removeFeature(feature));
  }

  vectorLayerSource.addFeature(pointFeature)
}

/**
 * Creates an OpenLayers point feature.
 */
export function createPoint(coordinates: number[], style: Style, type: PointType, label: "Start" | "End" | "Start/End" | undefined = undefined, index: number | undefined = undefined): Feature<Point> {
  const point = new Feature({
      geometry: new Point(coordinates)
  });

  point.set("type", type);
  point.set("label", label);
  if (type === "route-waypoint") point.set("index", index);
  point.setStyle(style);

  return point;
}

export function closestPathSegmentIndex(line: LineString, coordinate: number[]): number | null {
  const coordinates = line.getCoordinates();
  let closestIndex: number | null = null;
  let closestDistance = Infinity;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [startX, startY] = coordinates[index];
    const [endX, endY] = coordinates[index + 1];
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const projection = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((coordinate[0] - startX) * deltaX + (coordinate[1] - startY) * deltaY) / lengthSquared));
    const projectedX = startX + projection * deltaX;
    const projectedY = startY + projection * deltaY;
    const distance = (coordinate[0] - projectedX) ** 2 + (coordinate[1] - projectedY) ** 2;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function closestPointOnPath(line: LineString, coordinate: number[]): number[] | null {
  const coordinates = line.getCoordinates();
  let closestPoint: number[] | null = null;
  let closestDistance = Infinity;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [startX, startY] = coordinates[index];
    const [endX, endY] = coordinates[index + 1];
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const projection = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((coordinate[0] - startX) * deltaX + (coordinate[1] - startY) * deltaY) / lengthSquared));
    const point = [startX + projection * deltaX, startY + projection * deltaY];
    const distance = (coordinate[0] - point[0]) ** 2 + (coordinate[1] - point[1]) ** 2;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = point;
    }
  }

  return closestPoint;
}

export function clearRouteHoverFeature() {
  if (!routeHoverFeature) return;

  getManualRouteLayer()?.getSource()?.removeFeature(routeHoverFeature);
  routeHoverFeature = null;
}

export function updateRouteHoverFeature(event: MapBrowserEvent<PointerEvent>) {

  let coordinate

  if (
    !manualRouteFeature ||
    manualRouteState.userClicks.length < 2
  ) {
    clearRouteHoverFeature();
    return;
  }

  const hoveredRoute = event.map.forEachFeatureAtPixel(
    event.pixel,
    (feature) => feature === manualRouteFeature ? feature : undefined
  );
  if (!hoveredRoute) {
    clearRouteHoverFeature();
    if (routeLineIsDragging) coordinate = event.coordinate;
  } else {
    coordinate = closestPointOnPath(manualRouteFeature.getGeometry(), event.coordinate)
  }
  if (!coordinate) return;

  if (!routeHoverFeature) {
    routeHoverFeature = new Feature({
      geometry: new Point(coordinate),
      type: "route-hover"
    });
    routeHoverFeature.setStyle(createRouteHoverPointStyle());
    getManualRouteLayer()?.getSource()?.addFeature(routeHoverFeature);
  } else {
    routeHoverFeature.getGeometry()?.setCoordinates(coordinate);
  }
}

/**
 * Adds a translate interaction to start / end OpenLayers points
 */
export function setUpPointInteraction(layers: Array<VectorLayer<VectorSource>>) {
  const map = getMap();
  if (!map || !layers) return;

  // this removes any previous interaction
  if (interactivePointLayerInteraction) {
    map.removeInteraction(interactivePointLayerInteraction);
  }

  // this makes the OpenLayers interaction
  interactivePointLayerInteraction = new Translate({
    layers: layers,
    filter: (feature) => feature.getGeometry() instanceof Point // (only accounts for points)
  });

  map.addInteraction(interactivePointLayerInteraction);

  interactivePointLayerInteraction.on("translatestart", () => setCursor("grabbing"));
  interactivePointLayerInteraction.on("translating", () => setCursor("grabbing"));

  interactivePointLayerInteraction.on('translateend', async (event) => {
    const movedFeature = event.features.item(0);
    if (!movedFeature) return;

    const geometry = movedFeature.getGeometry();
    if (!(geometry instanceof Point)) return;
    const newCoordinates = geometry.getCoordinates();
    const pointType = movedFeature.get("type");
    try {
      if (!isPointInPolygon(toLonLat(newCoordinates))) {
        throw new Error("Waypoint moved outside UK", { cause: ERROR_MESSAGES.ROUTING.INCORRECT_LOCATION });
      }

      if (pointType === "start") {
        await addManualPoint(newCoordinates[0], newCoordinates[1], "start");
      } else if (pointType === "end" || pointType === "start-end") {
        await addManualPoint(newCoordinates[0], newCoordinates[1], "end");
      } else if (pointType === "route-waypoint") {
        await replaceIntermediaryPoint(movedFeature.get("index"), newCoordinates);
      }
      syncCoordinateInputs();
    } catch (error) {
      syncManualEndpointMarkers(manualRouteState.userClicks);
      syncCoordinateInputs();
      showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
    }
  });
}

//#endregion

//#region DELETING POINTS

export function deselectSelectedPoint(): null | undefined {
  if (selectedPoint) {
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));

    return null;
  }
  return
};

/**
 * Handles user clicks on saved points
 */
export function handleSelectSavedPoint(event: MapBrowserEvent<PointerEvent>): boolean {
  const map = getMap();

  if (selectedPoint) {
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
    selectedPoint = null;
  }

  let featureClicked = false;
  let newSelection: Feature<Point> | null = null;
  const savedPointsLayer = getSavedPointsLayer();

  map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
    if ( layer === savedPointsLayer && feature.getGeometry() instanceof Point ) {
      newSelection = feature as Feature<Point>;
      featureClicked = true;
      return;
    }
  });

  if (newSelection) {
    selectedPoint = newSelection;
    const pointName = selectedPoint.get("name");
    selectedPoint.setStyle(getSelectedPointStyle(pointName));
    deletePointModalNameDisplay.textContent = pointName;
    showModal(true, deletePointModal);
    return true;
  } else {
    return false;
  }
}

//#endregion
//#region SETTINGS

// ##### LIGHT / DARK THEME #####
export function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark");

  const currentCoordinates =  getLoadedRouteCoordinates() || manualRouteState.pathCoords

  resetElevationChart();
  if (currentCoordinates) {
    createElevationProfile(currentCoordinates);
    initChartToggleListener();
  };
}

// ##### HANDLING TOGGLING OF DISTANCE UNITS #####
export function handleDistanceUnitToggle() {

  resetElevationChart();

  // if there is a manual route present
  if (manualRouteState.pathCoords.length > 0) {
    updateManualRoute();
  }
  else if (getLastAutoRouteStats()) {
    displayLoadedRouteStats(getLastAutoRouteStats());
    toggleElevationChart();
  }
  else if (getLastLoadedRouteStats()) {
    displayLoadedRouteStats(getLastLoadedRouteStats());
    toggleElevationChart();
  }
  initChartToggleListener();

  const coords =
    manualRouteState.pathCoords.length > 1
      ? manualRouteState.pathCoords
      : (getCurrentPathData() || getLoadedRouteCoordinates());

  if (coords && coords.length > 1) createElevationProfile(coords);
};

//#endregion

// Initialisation

export function initInteractivePointLayer(map: Map) {
  interactivePointLayer = new VectorLayer({
    source: new VectorSource(),
    zIndex: 1100 // above the route layer + saved points layer
  });

  map.addLayer(interactivePointLayer);
}

export function initRouteLineInteraction(map: Map) {
  map.getViewport().addEventListener("mouseleave", clearRouteHoverFeature);

  routeLineDragInteraction = new PointerInteraction({
    handleMoveEvent: (event: MapBrowserEvent<PointerEvent>) => {
      updateRouteHoverFeature(event);
    },
    handleDownEvent: (event: MapBrowserEvent<PointerEvent>) => {
      if (!manualRouteFeature || manualRouteState.userClicks.length < 2) return false;
      lastMousePosition = event.pixel;
      lastMouseID = event.originalEvent.pointerId;

      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidate) => candidate === manualRouteFeature ? candidate : undefined
      );
      if (feature === manualRouteFeature) {
        routeLineIsDragging = true;
        closestSegmentIndex = closestPathSegmentIndex(manualRouteFeature.getGeometry(), event.coordinate);
      };
      return feature === manualRouteFeature;
    },
    handleDragEvent: (event: MapBrowserEvent<PointerEvent>) => {
      updateRouteHoverFeature(event);
      setCursor("grabbing");
    },
    handleUpEvent: (event: MapBrowserEvent<PointerEvent>) => {
      routeLineIsDragging = false;
      if (!manualRouteFeature) return false;

      // Check if user moved mouse signficantly
      if (lastMouseID !== event.originalEvent.pointerId) return true; // Protects against different pointers e.g different finger

      if (lastMousePosition) {
        const lastX = lastMousePosition[0];
        const lastY = lastMousePosition[1];

        lastMousePosition = null;

        const currentX = event.pixel[0];
        const currentY = event.pixel[1];

        if (
          Math.abs(lastX - currentX) < mousePositionThreshold &&
          Math.abs(lastY - currentY) < mousePositionThreshold
        ) {
          clearRouteHoverFeature();
          return false;
        };
      };

      const routeSegmentIndex = closestSegmentIndex === null
        ? null
        : getManualRouteSegmentIndex(closestSegmentIndex);

      if (routeSegmentIndex !== null) {

        void insertIntermediaryPoint(routeSegmentIndex + 1, event.coordinate)
          .then(() => syncCoordinateInputs())
          .catch((error: Error) => showToast(error.cause as string|| ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED));
      };

      updateCursor();
      clearRouteHoverFeature();

      return false;
    }
  });

  map.addInteraction(routeLineDragInteraction);
}

export function initRouting() {

  const map = getMap();

  addClickListener(searchForAreaButton, searchArea, "click");

  addClickListener(setStartCoordButton, setStartCoord, "click");
  addClickListener(setEndCoordButton, setEndCoord, "click");

  addClickListener(startCoordEntry, () => handleCoordEntryChange(startCoordEntry, "start"), 'change')
  addClickListener(endCoordEntry, () => handleCoordEntryChange(endCoordEntry, "end"), 'change')

  addClickListener(clearRouteButton, clearManualRoute, "click");
  addClickListener(homeButton, homeButtonFunction, "click");

  addClickListener(undoManualRouteButton, undoManualRoutePoint, "click");
  addClickListener(redoManualRouteButton, redoManualRoutePoint, "click");
  addClickListener(noRouteCardButton, closeSavedRoutesDash, "click");

  addClickListener(generatePathButton, () => void handleManualRouteGeneration(), "click");

  // Route saving
  addClickListener(saveRouteToggleButton, toggleSaveRouteContainer, "click");

  onMapClick(manualRouteClickHandler);
  if (map) initRouteLineInteraction(map);
}
