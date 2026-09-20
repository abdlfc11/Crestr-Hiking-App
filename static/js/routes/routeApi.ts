/**
 * Shared route HTTP helpers for the map page and saved-routes dashboard.
 * Implement the TODO blocks when you wire up each button.
 */

interface DeleteRouteResponse {
  success: boolean,
  message: string
}

interface LoadedRouteStats {
  total_distance: number,
  eta_seconds: number,
  elevation_change: number
}

interface LoadRouteResponse {
  success: boolean,
  message: string,
  pathGeoJSON: Object,
  map_centre: number[],
  coordinates: number[][],
  route_stats: LoadedRouteStats
}

interface DownloadRouteResponse {

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
