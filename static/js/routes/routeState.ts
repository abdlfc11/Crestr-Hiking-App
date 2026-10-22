// Shared route path / mode state for save, load, and map display. 

import localforage from "localforage";

type RoutingMode = "manual" | "auto";
type SegmentCache = Record<string, number[][]>;

interface ManualRouteState {
  userClicks: number[][];
  pathCoords: number[][];
  manualRoutePoints: number[][];
  isSnapped: boolean;
  segmentCache: SegmentCache;
  redoStack: number[][];
}

let currentPathData: number[][] | null = null;
let loadedRouteCoordinates: number[][] | null = null;
let currentMode: RoutingMode = "manual";
let lastKnownDistanceKm: number | null = null;
let lastAutoRouteStats: RouteStats | null = null;
let lastLoadedRouteStats: RouteStats | null = null;

// Simple border to have performace over exact accuracy
export const UKAndIrelandBorder = [[[-11.0, 51.0], [-11.0, 55.5], [-8.5, 59.0], [-5.0, 60.0], [-1.0, 61.0], [2.0, 57.0], [2.0, 52.0], [1.5, 51.0], [-3.0, 50.0], [-6.0, 49.5], [-9.0, 49.5], [-11.0, 51.0]]];

export const manualRouteState: ManualRouteState = {
  userClicks: [],
  pathCoords: [],
  manualRoutePoints: [],
  isSnapped: false,
  segmentCache: {},
  redoStack: []
};

export function getLastAutoRouteStats() {
  return lastAutoRouteStats;
}

export function setLastAutoRouteStats(value: RouteStats | null) {
  lastAutoRouteStats = value;
}

export function clearLastAutoRouteStats() {
  lastAutoRouteStats = null;
}

export function getLastLoadedRouteStats() {
  return lastLoadedRouteStats;
}

export function setLastLoadedRouteStats(value: RouteStats | null) {
  lastLoadedRouteStats = value;
}

export function clearLastLoadedRouteStats() {
  lastLoadedRouteStats = null;
}


export function getCurrentMode() {
  return currentMode;
}

export function setCurrentMode(mode: RoutingMode) {
  currentMode = mode;
}
 
// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
export function getCurrentPathData() {
  return currentPathData;
}

export function setCurrentPathData(data: number[][] | null) {
  currentPathData = data;
}

export function getLoadedRouteCoordinates() {
  return loadedRouteCoordinates;
}

// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
export function setLoadedRouteCoordinates(coords: number[][] | null) {
  loadedRouteCoordinates = coords;
}

export function setLastKnownDistanceKm(value: number | null) {
  lastKnownDistanceKm = value;
}

export function getLastKnownDistanceKm () {
  return lastKnownDistanceKm;
}

export function clearPathState() {
  currentPathData = null;
  loadedRouteCoordinates = null;
}

export async function clearManualRouteState() {
  manualRouteState.userClicks = [];
  manualRouteState.pathCoords = [];
  manualRouteState.manualRoutePoints = [];
  manualRouteState.isSnapped = false;
  manualRouteState.segmentCache = {};
  manualRouteState.redoStack = [];

  await Promise.all([
    localforage.removeItem('cachedSegmentCache'),
    localforage.removeItem('cachedPathCoords'),
    localforage.removeItem('cachedUserClicks')
  ])
}

export function hasActiveRouteStatsPanel() {
  return manualRouteState.pathCoords.length > 0 || lastAutoRouteStats !== null || lastLoadedRouteStats !== null; 
};

/**
 * Function to determine whether or not each coordinate of a path contains elevation 
 * @param {Array} coords 
 * @returns boolean value
 */
export function hasElevation(coords: number[][]): boolean {
  return coords.every(coord => coord.length === 3)
}

/**
 * Function to retrieve elevation of each coordinate in the path
 * @param {Array} coords 
 * @returns The elevation for each coordinate in the set of coordinates passed in, in the form of an array
 */
export function extractElevation(coords: number[][]): number[] {
  return coords.filter(coord => coord.length === 3).map(coord => coord[2])
}

/**
 * 
 * @param {Array} coords 
 * @returns An object formed of index : elevation pairs in the form { }
 */
export function extractElevationProfile(coords: number[][]): Array<{ index: number; elevation: number }> {
  return coords.filter(coord => coord.length === 3).map((coord, index) => ({
    index: index,
    elevation: coord[2]
  }));
};

/**
 * 
 * @param {Array} coords 
 * @returns The range of elevation of a path in the form { min: min_elevation, max: max_elevation }
 */
export function getElevationRange(coords: number[][]): { min: number | null; max: number | null } {
  if (!coords || coords.length === 0) return { min: null, max: null };

  // this extracts the elevation values of each coordinate
  const elevations = coords
    .filter(coord => coord && coord.length === 3)
    .map(coord => coord[2]);

  // this returns null values if no elevation data is present
  if (elevations.length === 0) return { min: null, max: null };

  // this uses the spread operator to find min and max values instantly
  return {
    min: Math.min(...elevations),
    max: Math.max(...elevations)
  };
}

/**
 * @param {Array} coords - Array of [long, lat, elev] arrays
 * @returns {number} The total elevation gain 
*/
export function calculateElevationGain(coords: number[][]): number {
  if (!coords || coords.length < 2) return 0;

  let totalGain = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];

    if (prev.length === 3 && curr.length === 3) {
      const elevationDifference = curr[2] - prev[2];
      // Only add positive differences (uphill)
      totalGain += Math.max(0, elevationDifference);
    }
  }

  return totalGain;
}

/**
 * Checks if a point is inside a polygon using the Ray-Casting algorithm.
 */
export function isPointInPolygon(point: number[], polygon: number[][][] = UKAndIrelandBorder): boolean {
  if (!point || point.length < 2) return false;

  const x = point[0]; // longitude
  const y = point[1]; // latitude

  if (!Array.isArray(polygon) || polygon.length === 0) {
    console.warn("UK polygon is empty");
    return false;
  }

  let inside = false;

  // This gets the exterior ring
  const ring = polygon[0];

  if (!ring || ring.length < 3) {
    console.warn("UK polygon has too little, or no, points");
    return false;
  };

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Ensures every coordinate is [x, y, elevation]
 * - First point gets elevation from second point if it's 0
 * - Forces numbers and consistent 3-element arrays
 */
export function normaliseCoordLength(coords: number[][] | null | undefined): number[][] {
  if (!coords || coords.length === 0) return [];

  let normalisedCoords = coords.map(coord => {
    if (Array.isArray(coord) && coord.length >= 3) {
      return [Number(coord[0]), Number(coord[1]), Number(coord[2]) || 0];
    } else if (Array.isArray(coord) && coord.length === 2) {
      return [Number(coord[0]), Number(coord[1]), 0];
    } else {
      console.warn("Invalid coord:", coord);
      return [0, 0, 0];
    }
  });

  // this forces first point to use second point's elevation if first is 0
  if (normalisedCoords.length >= 2) {
    const firstElev = normalisedCoords[0][2];
    const secondElev = normalisedCoords[1][2];

    if (firstElev === 0 && secondElev !== 0) { // check if the first coord element doesn't have elevation AND that there is second Elevation
      normalisedCoords[0][2] = secondElev;
    }
  }

  return normalisedCoords;
}
