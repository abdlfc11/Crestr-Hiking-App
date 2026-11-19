import { isMobileOrTablet, MAP_VIEW_PADDING } from "../constants";
import { getManualRouteLayer, getMap } from "../init/map";
import { createAutomaticRoutingTour, createMobileRoutingTour, createSavingRoutesTour } from "../tours/tours";
import { getManualRouteFeature, handleManualRouteGeneration, homeButtonFunction } from "./ui-routing";

let savingRoutesTourDriver
let automaticRoutingTourDriver
let mobileRoutingTour

const mobileNavDropdownContent = document.getElementById('mobile-nav-dropdown-content');
const mobileActionsButton = document.getElementById('mobile-actions-button');
const mobileActions = document.getElementById('mobile-actions');

export async function handleSaveRouteTour() {

  const mapView = getMap().getView();
  const manualRouteLayer = getManualRouteLayer();

  // creating a route
  await handleManualRouteGeneration('54.454722, -3.267793', '54.454195, -3.211540');
  manualRouteLayer.getSource().changed() // to update feature before map moves to it

  // moving map to route
  mapView.fit(getManualRouteFeature().getGeometry().getExtent(), {
    padding: MAP_VIEW_PADDING,
    duration: 1000
  })

  setTimeout(() => {
    savingRoutesTourDriver = createSavingRoutesTour(homeButtonFunction);

    savingRoutesTourDriver.drive();
  }, 1500);
}



export function handleInitialTour() {

  if (!localStorage.getItem('seenInitialTour')) {

    if (isMobileOrTablet) {

      mobileNavDropdownContent.classList.add("show");
      mobileActions.classList.add("show");
      mobileActionsButton.setAttribute("aria-expanded", "true");
      mobileActionsButton.setAttribute("aria-label", "Hide route actions");

      mobileRoutingTour = createMobileRoutingTour(handleSaveRouteTour);
      mobileRoutingTour.drive();

      mobileNavDropdownContent.classList.remove("show");
      mobileActions.classList.remove("show");
      mobileActionsButton.setAttribute("aria-expanded", "false");
      mobileActionsButton.setAttribute("aria-label", "Show route actions");
    } else {
      automaticRoutingTourDriver = createAutomaticRoutingTour(handleSaveRouteTour);
      automaticRoutingTourDriver.drive();
    };
  };
  localStorage.setItem('seenInitialTour', "true");
  return;
}
