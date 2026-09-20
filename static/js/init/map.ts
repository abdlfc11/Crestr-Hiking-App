// IMPORTS 

import "ol/ol.css?inline"

import { getRouteStrokeStyle } from "../utils/style-utils.js";

// OpenLayers Core & Views
import Map from "ol/Map.js";
import View from "ol/View.js";
import { defaults as defaultControls } from "ol/control.js";
import { fromLonLat } from "ol/proj.js";

// OpenLayers Layers
import Tile from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";

// OpenLayers Sources
import XYZ from "ol/source/XYZ.js";
import VectorSource from "ol/source/Vector.js";

// OpenLayers Styles
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";


export let map: Map | null = null;
export let tileLayer: Tile<XYZ> | null = null;
export let routeLayer: VectorLayer<VectorSource> | null = null;
export let manualRouteLayer: VectorLayer<VectorSource> | null = null;

export function getMap() {
  return map;
}

export function setRouteLayer(layer: VectorLayer<VectorSource> | null) {
  routeLayer = layer;
}

export function getRouteLayer() {
  return routeLayer;
}

export function setManualRoutelayer(layer: VectorLayer<VectorSource> | null) {
  manualRouteLayer = layer;
};

export function getManualRouteLayer() {
  if (manualRouteLayer === null) {
    createManualRouteLayer();
    return manualRouteLayer;
  } else {
    return manualRouteLayer;
  }
};

export function removeManualRouteLayer() {
  const map = getMap();
  if (!map) return;

  if (manualRouteLayer !== null) map.removeLayer(manualRouteLayer);
  manualRouteLayer = null;
}

export function routeLayerHasFeatures() {
  const source = getRouteLayer()?.getSource();
  return Boolean(source && source.getFeatures().length > 0);
}

export function getTileLayer() {
  return tileLayer;
}

export function setTileLayer(layer: Tile<XYZ> | null) {
  tileLayer = layer;
}

export function createMap() {
  const initialCentreLatLon = Array.isArray(window.appConfig?.mapInitialCentre)
    ? window.appConfig.mapInitialCentre
    : [-3.198308, 54.465458];
  const initialCentre = fromLonLat(initialCentreLatLon);
  const initialZoom = window.appConfig?.mapInitialZoom ?? 10.5;

  map = new Map({
    layers: [tileLayer],
    target: "map",
    controls: defaultControls({
      attributionOptions: {
        collapsible: false
      }
    }),
    view: new View({
      projection: "EPSG:3857",
      maxZoom: 17,
      minZoom: 0,
      center: initialCentre,
      zoom: initialZoom,
    }),
  });
}

export function onMapClick(handler: (...args: any[]) => void) {
  const m = getMap();
  if (m) m.on("click", handler);
}

export function onMapRenderComplete(handler: (...args: any[]) => void) {
  const m = getMap();
  if (m && typeof handler === "function") {
    m.once("rendercomplete", handler);
  }
}

export function createTileLayer() {
  tileLayer = new Tile({
    source: new XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: `
      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      |
      Map data: © <a href="https://www.openstreetmap.org/copyright/">OpenStreetMap</a>,
      SRTM
      |
      Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)
      `,
      maxZoom: 17,
    }),
  });
}

export function createRouteLayer() {
  routeLayer = new VectorLayer({
    source: new VectorSource(),
    style: new Style({
      stroke: new Stroke(getRouteStrokeStyle()),
    }),
    zIndex: 999,
  });

  const map = getMap();
  if (map) map.addLayer(routeLayer);
  else console.error("ERROR (createRouteLayer()) : Could not add routeLayer to the map");
}

export function createManualRouteLayer() {
  manualRouteLayer = new VectorLayer({
    source: new VectorSource(),
    style: new Style({
      stroke: new Stroke(getRouteStrokeStyle())
    }),
    zIndex: 999
  });

  const map = getMap();
  if (map) map.addLayer(manualRouteLayer);
  else console.error("ERROR (createManualRouteLayer()) : Could not add manualRouteLayer to the map");
};

export function getPathColour() {
  return "#2563eb";
}

// Init

let mapInitialised = false;

export function initMap() {
    if (mapInitialised) return;
    mapInitialised = true;
    createTileLayer();
    createMap();
    createRouteLayer();
}