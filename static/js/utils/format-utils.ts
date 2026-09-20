/**
 * This file is intended to hold all formatting related functions
 * As of July 2026 this file hold the following functions:
 *      
 *      - formatDistance(distanceLm)
 *      - formatETA(seconds)
 *      - formatElevation(elevation)
 */

import { getAppSettings } from "../settingsState.js"; // runtime ESM specifier resolves to settingsState.ts


/**
 * Creates a formatted distance string from a distanceKm variable that is a number (float) 
 */
export function formatDistance(distanceKm: number): string {
  const appSettings = getAppSettings(); // retrieves a typed copy of the app settings
  const distanceUnit = appSettings?.distanceUnit;

  if (distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371; 
    return `${distanceMiles.toFixed(2)} mi`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Creates a formatted ETA string from a seconds variable that is either an int/float or a string 
 */
export function formatETA(seconds: string | number): string {
    const numericSeconds = Number(seconds);

    const hours = Math.floor(numericSeconds / 3600);
    const minutes = Math.floor((numericSeconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

/**
 * Creates a formatted Elevation string from an elevatio var which may be an int/float or a string
 */
export function formatElevation(elevation: string | number): string {
  const elevNum = Math.round(Number(elevation))
  const elevDisplayValue = isNaN(elevNum) ? "0m" : (elevNum >= 0 ? `+${elevNum} m` : `${elevNum} m`)

  return elevDisplayValue
}
