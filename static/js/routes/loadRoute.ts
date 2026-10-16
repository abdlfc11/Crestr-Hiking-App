import { getMap, getRouteLayer } from "../init/map.js";

import GeoJSON from "ol/format/GeoJSON.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Point from "ol/geom/Point.js"
import Feature from "ol/Feature.js"
import {
  fromLonLat
} from "ol/proj.js"

import {
  formatDistance,
  formatElevation,
  formatETA
} from "../utils/format-utils.js"

import {
  getRouteStrokeStyle
} from "../utils/style-utils.js"

import {
  createStatsPanel,
  showToast
} from "../utils/ui-utils.js"

import { 
  clearManualRouteState,
  getLastLoadedRouteStats,
  setCurrentPathData,
  setLastKnownDistanceKm,
  setLastLoadedRouteStats,
  setLoadedRouteCoordinates
} from "./routeState.js";

import { getSavedPointStyle } from "../saved_points/style.js";

import { MAP_VIEW_PADDING } from "../constants.js";
import type { LoadRouteResponse } from "./route_types.js";
import { createElevationProfile, initChartToggleListener, resetElevationChart } from "../elevationChart.js";

export async function displaySharedRoute(routeId: string) {

  try {
    const url = `${window.appConfig.apiGetSharedRouteUrl}/${encodeURIComponent(routeId)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Load Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error loading this route, please try again later."})
    };

    await displayLoadedRouteOnMap(data);
    await initChartToggleListener();
    await createElevationProfile(data.coordinates);

    clearManualRouteState();
    await setLoadedRouteCoordinates(data.coordinates);
    await setCurrentPathData(data.coordinates);
  } catch (error) {
    console.error(error.message);
    showToast(error.cause || "Sorry, there was an error loading this route, please try again later.")
  }
}


export function displayLoadedRouteOnMap(data: LoadRouteResponse) {

  const map = getMap();
  const routeLayer = getRouteLayer();
  if (!map || !routeLayer) return;

  const vectorSource = routeLayer.getSource();
  vectorSource.clear();

  const format = new GeoJSON();
  const features = format.readFeatures(data.pathGeoJSON, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });


  features.forEach((feature) => {
    feature.setStyle(
      new Style({
        stroke: new Stroke(getRouteStrokeStyle()),
      }),
    );
  });

  const coordinates = data.coordinates;

  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1]

  // converts lon lat to Web Mercator to display features on OpenLayer map (which has Web Mercator projection) 
  const startMercator = fromLonLat([startCoord[0], startCoord[1]]);
  const endMercator = fromLonLat([endCoord[0], endCoord[1]]);

  const startFeature = new Feature({
    geometry: new Point(startMercator)
  });
  startFeature.setStyle(getSavedPointStyle("Start", "#00A86B"));

  const endFeature = new Feature({
    geometry: new Point(endMercator)
  });
  endFeature.setStyle(getSavedPointStyle("End", "#D32F2F"));



  vectorSource.addFeatures(features);
  vectorSource.addFeature(startFeature);
  vectorSource.addFeature(endFeature);

  const view = map.getView();

  setTimeout(() => {
    view.fit(vectorSource.getExtent(), {
      size: map.getSize(),
      padding: MAP_VIEW_PADDING,
      duration: 1100
    })
  }, 100)
  setLastLoadedRouteStats(data.route_stats)
  displayLoadedRouteStats(getLastLoadedRouteStats());
}

export function displayLoadedRouteStats(routeStats: RouteStats | null) {
  if (!routeStats) return;
  if (getLastLoadedRouteStats()) resetElevationChart();

  setLastKnownDistanceKm(Number(routeStats.total_distance));

  let statsDiv = document.getElementById("route-stats");

  if (statsDiv) {
    statsDiv.remove();
  };

  statsDiv = document.createElement("div");
  statsDiv.id = "route-stats";
  document.body.appendChild(statsDiv);

  statsDiv.innerHTML = createStatsPanel(
    formatDistance(Number(routeStats.total_distance)),
    formatETA(routeStats.eta_seconds),
    formatElevation(routeStats.elevation_change ?? 0),
  )
}
