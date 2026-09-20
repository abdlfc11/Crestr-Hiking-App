/**
 * This file is intended to hold all OpenLayers map related helper functions
 * As of August 2026 this file hold the following functions:
 *      
 *      - moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5)
 */

import { fromLonLat } from "ol/proj";
import type Map from "ol/Map.js";

/**
 * Function to move the map to a specific coordinate or the centre of the map via an animation
 */
export function moveMapToPosition(map: Map | null, position: number[] | null = null, duration: number = 1200, zoom: number = 10.5) {
  if (!map) {
    console.warn("No map, returning");
    return;
  }

  const targetLatLon = Array.isArray(position) && position.length === 2
    ? position
    : (Array.isArray(window.appConfig?.mapInitialCentre) ? window.appConfig.mapInitialCentre : [-3.198308, 54.465458]);

  // this converts [Lon, Lat] coordinates into Web Mercator coordinates that the OpenLayers map can use 
  const targetPosition = fromLonLat(targetLatLon);

  map.getView().animate({
    center: targetPosition,
    zoom: zoom,
    duration: duration
  })
};
