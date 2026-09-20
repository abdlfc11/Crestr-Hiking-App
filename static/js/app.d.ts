type Coordinate = [number, number] | [number, number, number];

type DistanceUnit = "km" | "miles";
type ThemePreference = "light" | "dark" | "system";

interface AppSettings {
  distanceUnit: DistanceUnit;
  theme: ThemePreference;
}

interface RouteStats {
  total_distance: number | string;
  eta_seconds: number | string;
  elevation_change?: number | string;
  elevation_gain?: number | string;
  elevation_gain_m?: number | string;
}

interface LoadRouteResponse {
  success: boolean,
  message: string,
  pathGeoJSON: Object,
  map_centre: number[],
  coordinates: number[][],
  route_stats: LoadedRouteStats
}

interface CrestrAppConfig {
  loggedIn: boolean;
  mapInitialCentre: [number, number];
  mapInitialZoom: number;
  initialCurrentPath: unknown;
  initialSavedPointsLookup: Record<string, string>;
  apiLoginUrl: string;
  apiLogoutUrl: string;
  apiRegisterUrl: string;
  apiDeleteAccountUrl: string;
  apiCalculatePathUrl: string;
  apiSaveRouteUrl: string;
  apiLoadRouteUrl: string;
  apiDeleteRouteUrl: string;
  apiDownloadRouteFileUrl: string;
  apiImportRouteUrl: string;
  apiNormaliseRouteStatsUrl: string;
  apiSearchAreaUrl: string;
  apiSavePointUrl: string;
  apiGetSavedPointsUrl: string;
  apiDeletePointUrl: string;
  apiGetSettings: string;
  apiSaveSettings: string;
  mapPageUrl: string;
  apiLogErrorUrl: string;
  apiReportIssueUrl: string;
}

interface Window {
  appConfig: CrestrAppConfig;
}

declare const apiLoginUrl: string;
declare const apiRegisterUrl: string;
