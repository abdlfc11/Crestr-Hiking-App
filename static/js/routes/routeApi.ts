/**
 * Shared route HTTP helpers for the map page and saved-routes dashboard.
 * Implement the TODO blocks when you wire up each button.
 */

import { ERROR_MESSAGES } from "../utils/error-constants"
import type { LoadRouteResponse } from "./route_types"

interface DeleteRouteResponse {
  success: boolean,
  message: string
}

interface GetRouteDataResponse {
  success: boolean
  coordinates: number[][]
  elevation_gain: string
  distance_km: number
  eta_seconds: number
  name: string
}

interface AddSharedRouteInput {
  coordinates: number[][]
  elevation_gain: string
  distance_km: number
  eta_seconds: number
  name: string
  route_id: string
}

interface AddSharedRouteResponse {
  success: boolean
  code: string
}

export async function getRouteData(routeName: string): Promise<GetRouteDataResponse> {

  const url = window.appConfig.apiGetRouteDataUrl; 

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName
    })
  })

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || `getRouteData() : ${response.status}`, {cause: data.user_message || ERROR_MESSAGES.generic})
  }
  
  return data

}

export async function addSharedRoute(routeData: AddSharedRouteInput): Promise<AddSharedRouteResponse> {
  const url = window.appConfig.apiAddSharedRouteUrl

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(routeData)
  });

  const data = await response.json();

  if (!response.ok || (!data.success && !data.code)) {
    throw new Error(data.message || `addSharedRoute() : ${response.status}`, {cause: data.user_message || ERROR_MESSAGES.generic})
  }; 

  return data
}

export async function deleteRoute(routeName: string): Promise<DeleteRouteResponse> {

  const url = window.appConfig.apiDeleteRouteUrl

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Load Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error downloading your route, please try again later."});
  }

  return data
}

export async function loadRoute(routeName: string): Promise<LoadRouteResponse> {
  const url = window.appConfig.apiLoadRouteUrl;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Load Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error loading your route, please try again later."});
  }

  return data;
}


export async function downloadRoute(routeName: string, format: "gpx" | "geojson", DOMElement: HTMLButtonElement,): Promise<Blob> {

  const url = window.appConfig.apiDownloadRouteFileUrl
  DOMElement.classList.add('loading');

  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      route_name: routeName,
      route_type: format
    })
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Download Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error downloading your route, please try again later."});
  }

  DOMElement.classList.remove('loading')
  return await response.blob()
}
