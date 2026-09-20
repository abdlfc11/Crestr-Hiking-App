/**
 * This file all route-associated helper functions 
 * As of August 2026 it has the following functions:
 * 
 *      - roundCoords(coordArray, decimals)
 *      - isLonLat(coordinate)
 *      - isMercatorCoord(coordinate)
 *      - formatLatLon(lonLat)
 *      - calculateTotalDistance(points)
 *      - CalculateEta(distanceKm)
 */

import { toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere.js"

/**
 * Rounds coordinates to a specific decimal point 
 */
export function roundCoords(coordArray: number[], decimals: number): number[] {

    const [x, y] = coordArray;

    if (decimals === 0) {
        return [Math.round(x), Math.round(y)]
    }

    const multiplier = 10 ** decimals;

    const roundedX = Math.round(x * multiplier) / multiplier;
    const roundedY = Math.round(y * multiplier) / multiplier;


    return [roundedX, roundedY];
}

/**
 * Validates whether the input is a valid WGS84 (lat / lon) coordinate 
 */
export function isLonLat(coordinate: number[] | Object): boolean {

  // local variables to store extracted coordinate values
  let lat;
  let lon;

  // stores if coordinate is array or not 
  const isCoordinateArray = Array.isArray(coordinate)

  // this ensures it handles dictionaries (objects)
  if (coordinate && typeof coordinate === 'object' && !isCoordinateArray) {
    const candidate = coordinate as Record<string, unknown>;
    lat = candidate.lat ?? candidate.latitude;
    lon = candidate.lon ?? candidate.lng ?? candidate.longitude;
  }

  // this ensures it handles arrays 
  else if (isCoordinateArray && coordinate.length >= 2) {
    lon = coordinate[0];
    lat = coordinate[1]
  }

  // returns false for any other format 
  else {
    console.warn('isLonLat(coord) : Pass dictionary/object or array into function "isLonLat". ');
    return false;
  };

  // this ensures that both lat and lon variables are numbers and can be used in the conditional checks to ensure they are valid WGS84 coordinates 
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    console.warn('isLonLat(coord) : variable lat is either not a number or is infinite')
  }; 

  if (typeof lon !== 'number' || !Number.isFinite(lon)) {
    console.warn('isLonLat(coord) : variable lon is either not a number or is infinite')
  }; 

  // this returns true if lat is between -90 and 90 and if lon is between -180 and 180, and returns false otherwise
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Detects whether a coordinate is in Web Mercator (EPSG:3857) based on magnitude
 * Lat/lon values are always within [-180, 180] / [-90, 90]
 */
export function isMercatorCoord(coordinate: number[]): boolean {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return false;
  return Math.abs(coordinate[0]) > 181 || Math.abs(coordinate[1]) > 181;
}

/**
 * Formats a [lon, lat] coordinate into a user-friendly "lat, lon" string
 */
export function formatLatLon(lonLat: number[], decimals: number = 6): string {
  if (!Array.isArray(lonLat) || lonLat.length < 2) return "";
  const [lon, lat] = lonLat;
  const round = (value: number) => Number(value).toFixed(decimals);
  return `${round(lat)}, ${round(lon)}`;
}

/**
 * Returns the total distance of the route in KM 
 */
export function calculateTotalDistance(points: number[][]): number {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = toLonLat(points[i - 1]);
    const current = toLonLat(points[i]);
    totalDistance += getDistance(previous, current)
  }
  return totalDistance;
}
/**
 * Generates a user-facing string displaying the total time estimated to complete the route 
 */
export function calculateEta(distanceKm: number): string {
  const averageHikingSpeed = 4.0;
  const etaHours = distanceKm / averageHikingSpeed;
  const etaMinutes = Math.floor(etaHours * 60);
  const etaHoursInt = Math.floor(etaHours);
  const etaMinutesRemainder = etaMinutes % 60;

  if (etaHoursInt > 0) {
    return `${etaHoursInt}h ${etaMinutesRemainder}m`;
  }

  return `${etaMinutesRemainder}m`;
}
