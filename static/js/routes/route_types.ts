export interface LoadRouteResponse {
  success: boolean,
  message: string,
  pathGeoJSON: Object,
  map_centre: number[],
  coordinates: number[][],
  route_stats: LoadedRouteStats
}

interface LoadedRouteStats {
  total_distance: number,
  eta_seconds: number,
  elevation_change: number
}