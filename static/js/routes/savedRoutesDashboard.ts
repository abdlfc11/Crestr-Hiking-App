/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired through the typed route API helpers.
 */

import { deleteRoute, downloadRoute, loadRoute } from "./routeApi.js";

import { closeSavedRoutesDash } from "../ui/ui.js"

import { displayLoadedRouteOnMap } from "./loadRoute.js";

import { setLoadedRouteCoordinates, setCurrentPathData, clearManualRouteState } from "./routeState.js";

import { createElevationProfile, initChartToggleListener } from "../elevationChart.js";

import {
  addClickListener,
  createNoRouteCard,
  showToast
} from "../utils/ui-utils.js"

import { formatDistance } from "../utils/format-utils.js";

const allRoutesContainer = document.getElementById("all-routes-container");

/**
 * Function responsible for updating the distance values of saved route cards
 */
export function updateSavedRouteCards() {
  const statValues = document.querySelectorAll<HTMLElement>('[data-distance-km]');
  statValues.forEach(value => {
    const rawKm = parseFloat(value.dataset.distanceKm);
    if (isNaN(rawKm)) return;
    const formattedValue = formatDistance(rawKm);
    value.textContent = formattedValue;
  });
};

/**
 * Reads the route name and format from the closest route card
 */
export function getRouteFromCard(routeCardElement: HTMLElement | null): {routeName : string} | null {
  if (!routeCardElement) return null;

  const routeName = routeCardElement.dataset.routeName;
  if (!routeName) return null;

  return { routeName };
}

/**
 * Handles the sequence of events that occur following the clicking of the load route button 
 */
async function onLoadClick(event: MouseEvent) {
  const routeCard = (event.target as HTMLElement).closest<HTMLElement>('.route-card');
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  try {
    const data = await loadRoute(route.routeName);
    await displayLoadedRouteOnMap(data);
    await initChartToggleListener();
    await createElevationProfile(data.coordinates)

    // both set calls could set coords whereby each coord is formed of 3 elements i.e (x, y and elevation)
    clearManualRouteState();
    await setLoadedRouteCoordinates(data.coordinates);
    await setCurrentPathData(data.coordinates);
    await closeSavedRoutesDash();
  } catch (error) {
    showToast(error.cause || "Sorry, there was an error loading your route, please try again later.")
  }

  event.preventDefault();
}

/**
 * Handles the sequence of events that occur following the clicking of the delete route button 
 */
async function onDeleteClick(event: MouseEvent) {
  const routeCard = (event.target as HTMLElement).closest<HTMLElement>(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  const check = confirm(`Are you sure you want to delete the route: ${route.routeName}?`);
  if (!check) {
    return;
  }

  try {
    const response = await deleteRoute(route.routeName);
    if (response.success) {
      routeCard.remove();

      const remainingCards = document.querySelectorAll('.route-card');

      if (remainingCards.length === 0) {
        allRoutesContainer.insertAdjacentHTML('beforeend', createNoRouteCard());
        const createRouteButton = document.getElementById('no-route-create-button'); 
        addClickListener(createRouteButton, closeSavedRoutesDash, "click")
      }

    }
  } catch (error) {
    showToast(error.cause || "Sorry, there was an error downloading your route, please try again later.")
  }

  event.preventDefault();
}

/**
 * Handles the sequence of events that occur following the clicking of the download route button 
 */
async function onDownloadClick(
  event: MouseEvent,
  format: "gpx" | "geojson",
  DOMElement: HTMLButtonElement,
) {

  DOMElement.classList.add('loading')
  DOMElement.disabled = true;

  event.preventDefault();

  const routeCard = (event.target as HTMLElement).closest<HTMLElement>(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) {
    DOMElement.disabled = false;
    DOMElement.classList.remove('loading');
    return;
  }
  
  try {

    console.log('BEFORE DOWNLOAD ROUTE')

    const blob = await downloadRoute(route.routeName, format, DOMElement); 

    console.log('AFTER DOWNLOAD ROUTE')

    console.log(route.routeName)
    console.log(format)

    const filename = `${route.routeName}.${format}`

    const url = URL.createObjectURL(blob); // this creates a temp URL that points to the file to be dowloaded in browsers memory

    const a = document.createElement('a'); // this creates a hidden link

    a.href = url; // sets the link's pointer to the url

    a.download = filename; // sets download link to the filename

    document.body.appendChild(a); // adds the link to the html file

    a.click(); // simulates click starting the download

    // good practice to remove the link + download url
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);

  } 
  catch(error) {

    showToast(error.cause || "Sorry, there was an error downloading your route, please try again later.")
  }
  finally {
    DOMElement.disabled = false;
    DOMElement.classList.remove('loading')
  }
}

/** 
* Handles adding the event listeners for each button on the route card
*/
function bindRouteCardButtons() {
  if (!allRoutesContainer) return;

  allRoutesContainer.addEventListener('click', (e) => {

    const target = e.target as HTMLElement;
    const deleteButton = target.closest<HTMLButtonElement>('.route-btn-delete');
    const loadButton = target.closest<HTMLButtonElement>('.route-btn-load');
    const gpxButton = target.closest<HTMLButtonElement>('.route-btn-download-gpx')
    const geojsonButton = target.closest<HTMLButtonElement>('.route-btn-download-geojson')

    if (deleteButton) {
      void onDeleteClick(e)
    }
    else if (loadButton) {
      void onLoadClick(e)
    }
    else if (gpxButton) {
      void onDownloadClick(e, "gpx", gpxButton)
    }
    else if (geojsonButton) {
      void onDownloadClick(e, "geojson", geojsonButton)
    }
  })
}

/**
 * Responsible for adding event listener to the go back button
 */
function bindNavigation() {
  const goBackButton = document.getElementById("go-back-button");
  if (goBackButton) {
    goBackButton.addEventListener("click", () => {
      window.location.href = "/map";
    });
  }
}

/**
 * Responsible for initialising the event listeners by calling both functions associated with adding event listeners 
 */
export function initSavedRoutesDashboard() {
  bindNavigation();
  bindRouteCardButtons();
}

addClickListener(document, initSavedRoutesDashboard, "DOMContentLoaded")
