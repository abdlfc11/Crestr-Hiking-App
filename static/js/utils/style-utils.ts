/**
 * This file is intended to hold all styling related functions
 * As of July 2026 this file hold the following functions:
 *
 *      - createManualPointStyle(label, colour, radius=7.5, strokeBorderColor="#FFFFFF")
 *      - getRouteStrokeStyle()
 *
 */

import Fill from "ol/style/Fill"
import Stroke from "ol/style/Stroke"
import Circle from "ol/style/Circle"
import Style from "ol/style/Style"
import type { Options as StrokeOptions } from "ol/style/Stroke.js"


/**
 * Returns the styling to be applied to intermediary points on a route (i.e points that aren't start/end)
 */
export function createManualPointStyle(): Style {
  return new Style({
    image: new Circle({
      radius: 6.5,
      fill: new Fill({
        color: "#000000"
      }),
      stroke: new Stroke({
        color: "#FFFFFF",
        width: 3
      })
    }),
    zIndex: 1000
  })
}

/**
 * Returns the styling for temporary points created on a route when hovering over the elevation chart
 */
export function createElevationPointStyle(): Style {
  return new Style({
    image: new Circle({
      radius: 7.5,
      fill: new Fill({
        color: '#FFFFFF'
      }),
      stroke: new Stroke({
        color: '#0a45e7',
        width: 3
      })
    }),
    zIndex: 1200
  })
}

/**
 * For when a user hovers over a route feature
 */
export function createRouteHoverPointStyle(): Style {
  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({
        color: "#2563eb"
      }),
      stroke: new Stroke({
        color: "#FFFFFF",
        width: 2
      })
    }),
    zIndex: 1100
  })
}

/**
 * Returns the styling of route features displayed on the map
 */
export function getRouteStrokeStyle(): StrokeOptions {
  return {
    color: "#2563eb",
    width: 8,
    lineCap: "round",
    lineJoin: "round",
  }
}
