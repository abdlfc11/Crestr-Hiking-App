/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired through the typed route API helpers.
 */

import {
  addSharedRoute,
  deleteRoute,
  downloadRoute,
  getRouteData,
  loadRoute
} from "./routeApi.js";

import {
  closeSavedRoutesDash
} from "../ui/ui.js"

import {
  displayLoadedRouteOnMap
} from "./loadRoute.js";

import {
  setLoadedRouteCoordinates,
  setCurrentPathData,
  clearManualRouteState
} from "./routeState.js";

import {
  createElevationProfile,
  initChartToggleListener
} from "../elevationChart.js";

import {
  addClickListener,
  createNoRouteCard,
  showModal,
  showToast
} from "../utils/ui-utils.js"

import { formatDistance } from "../utils/format-utils.js";

import { nanoid } from "nanoid";

import QRCode from "qrcode";

const allRoutesContainer = document.getElementById("all-routes-container");

const shareRouteModalCanvas = document.getElementById('share-route-dialog-canvas') as HTMLCanvasElement | null;
const shareRouteModal = document.getElementById('share-route-dialog') as HTMLDialogElement | null;

function closeRouteMenus(exceptMenu?: HTMLElement) {
  document.querySelectorAll<HTMLElement>('.route-actions-menu:not([hidden])').forEach(menu => {
    if (menu === exceptMenu) return;

    menu.hidden = true;
    menu.closest('.route-card-actions')
      ?.querySelector<HTMLButtonElement>('.route-options-button')
      ?.setAttribute('aria-expanded', 'false');
  });
}

function toggleRouteMenu(button: HTMLButtonElement) {
  const menu = button.parentElement?.querySelector<HTMLElement>('.route-actions-menu');
  if (!menu) return;

  const shouldOpen = menu.hidden;
  closeRouteMenus(menu);
  menu.hidden = !shouldOpen;
  button.setAttribute('aria-expanded', String(shouldOpen));
}

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

    const blob = await downloadRoute(route.routeName, format, DOMElement); 

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

async function onShareRouteClick(
  event: MouseEvent
) {
  event.preventDefault();

  const routeCard = (event.target as HTMLElement).closest<HTMLElement>(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) {
    return;
  }

  try {

    const urlId = nanoid(); 

    const routeData = await getRouteData(route.routeName); 

    console.log(routeData);

    const sharedRouteData = {
      name: routeData.name,
      coordinates: routeData.coordinates,
      elevation_gain: routeData.elevation_gain,
      distance_km: routeData.distance_km,
      eta_seconds: routeData.eta_seconds,
      route_id: urlId,
    };

    const addSharedRouteResponse = await addSharedRoute(sharedRouteData);

    const url = new URL("/map", window.location.origin);
    url.searchParams.set("route_id", addSharedRouteResponse.code)
    
    await QRCode.toCanvas(shareRouteModalCanvas, url.toString());
    showModal(true, shareRouteModal);

    await navigator.clipboard.writeText(url.toString());
    
    showToast("URL copied to clipboard", "success", shareRouteModal)
  } catch (error) {
    showToast(error.cause || "Sorry, there was an error sharing your route, please try again later.");
  }
  
}

/** 
* Handles adding the event listeners for each button on the route card
*/
function bindRouteCardButtons() {
  if (!allRoutesContainer) return;

  allRoutesContainer.addEventListener('click', (e) => {

    const target = e.target as HTMLElement;
    const optionsButton = target.closest<HTMLButtonElement>('.route-options-button');
    const deleteButton = target.closest<HTMLButtonElement>('.route-btn-delete');
    const loadButton = target.closest<HTMLButtonElement>('.route-card-actions-load-route-button');
    const gpxButton = target.closest<HTMLButtonElement>('.route-btn-download-gpx');
    const geojsonButton = target.closest<HTMLButtonElement>('.route-btn-download-geojson');
    const shareRouteButton = target.closest<HTMLButtonElement>('.share-route-button'); 

    if (optionsButton) {
      e.preventDefault();
      toggleRouteMenu(optionsButton);
    }
    else if (deleteButton) {
      closeRouteMenus();
      void onDeleteClick(e)
    }
    else if (loadButton) {
      closeRouteMenus();
      void onLoadClick(e)
    }
    else if (gpxButton) {
      closeRouteMenus();
      void onDownloadClick(e, "gpx", gpxButton)
    }
    else if (geojsonButton) {
      closeRouteMenus();
      void onDownloadClick(e, "geojson", geojsonButton)
    }
    else if (shareRouteButton) {
      closeRouteMenus();
      void onShareRouteClick(e)
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.route-card-actions')) closeRouteMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openMenu = document.querySelector<HTMLElement>('.route-actions-menu:not([hidden])');
    if (!openMenu) return;

    const optionsButton = openMenu.closest('.route-card-actions')
      ?.querySelector<HTMLButtonElement>('.route-options-button');
    closeRouteMenus();
    optionsButton?.focus();
  });
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

if (document.readyState === "loading") {
  addClickListener(document, initSavedRoutesDashboard, "DOMContentLoaded"); // HTML has not been fully read yet
} else {
  initSavedRoutesDashboard(); // HTML has been fully read
}
