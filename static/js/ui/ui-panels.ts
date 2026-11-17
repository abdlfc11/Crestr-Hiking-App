//#region IMPORTS

import { removeDOMElement, showToast } from "../utils/ui-utils.js";
import { displayImportedRouteCard, processImportedRouteFile } from "../importRoute.js";
import {
  createImportRoutePanelTour, createSavedRouteDashboardTour, createSettingsTour
} from "../tours/tours.js";
import { showLoginModal } from "./ui-modals.js";

//#endregion

//#region VAR / CONST DECLARATIONS

// Save route accordion
const saveRouteDiv = document.getElementById("save-route");
const saveRouteToggleButton = document.getElementById("save-route-toggle-button");

// Navigation panels
const mobileNavDropdownContent = document.getElementById('mobile-nav-dropdown-content');
export const savedRoutesDashContent = document.getElementById('saved-routes-dashboard');
const noRouteCardDiv = document.getElementById('no-routes-wrapper-container');
const settingPanel = document.getElementById("settings-panel");
const importRoutePanel = document.getElementById("import-route-panel");

// Route import controls
const importRouteFileInput = document.getElementById('import-route-file-input') as HTMLInputElement | null;
const importRouteURLInput = document.getElementById('import-route-url-input') as HTMLInputElement | null;
const importRouteNameEntry = document.getElementById('import-route-name-input') as HTMLInputElement | null;
const fileInputType = document.getElementById('file-route-input-type') as HTMLInputElement | null;
const URLInputType = document.getElementById('url-route-input-type') as HTMLInputElement | null;
const allowedFileTypes = ['.gpx', '.kml', '.geojson', '.fit'];

//#endregion

//#region OPEN/CLOSE PANEL FUNCTIONS

/**
 * Closes all panels accessible from the navigation raile
 */
export function closePanels() {
  const panels = [savedRoutesDashContent, importRoutePanel, settingPanel];

  panels.forEach(panel => {
    if (panel.style.width)
    panel.style.width = "0";
  });
};

export function openSavedRoutesDash() {

  // This prevents non-logged in and registered users from opening the save route panel
  if (!window.appConfig.loggedIn) {
    showLoginModal(true, "save routes");
    return;
  };

  if (mobileNavDropdownContent.classList.contains("show")) mobileNavDropdownContent.classList.remove("show");

  savedRoutesDashContent.style.width = "100vw";

  if (!localStorage.getItem('seenSavedRouteDashTour')) {
    const savedRouteDashTourDriver = createSavedRouteDashboardTour();

    savedRouteDashTourDriver.drive();

    localStorage.setItem('seenSavedRouteDashTour', 'True')
    return;
  }
  return;
};

export function closeSavedRoutesDash() {
  savedRoutesDashContent.style.width = "0";
};

export function openSettings() {
  settingPanel.style.width = "100vw";

  if (mobileNavDropdownContent.classList.contains("show")) mobileNavDropdownContent.classList.remove("show");

  if (!localStorage.getItem('seenSettingsTour')) {
    const settingsTourDriver = createSettingsTour();

    settingsTourDriver.drive();

    localStorage.setItem('seenSettingsTour', 'True')
    return;
  }
  return;
};

export function closeSettings() {
  settingPanel.style.width = "0";
};

export function openImportRoute() {

  // This prevents non-logged in and registered users from opening the import route panel
  if (!window.appConfig.loggedIn) {
    showLoginModal(true, "import routes");
    return;
  };

  if (mobileNavDropdownContent.classList.contains("show")) mobileNavDropdownContent.classList.remove("show");

  importRoutePanel.style.width = "100vw";

  if (!localStorage.getItem('seenImportRouteTour')) {
    const importRouteTourDriver = createImportRoutePanelTour();

    importRouteTourDriver.drive();

    localStorage.setItem('seenImportRouteTour', 'True')
    return;
  }
  return;
};

export function  closeImportRoute() {
  importRoutePanel.style.width = "0";
};

//#endregion
//#region IMPORT ROUTE PANEL FUNCTIONS

export async function handleRouteImport() {
  const selectedInputType = whichInputTypeSelected();
  let routeName;
  let data;

  if (selectedInputType === "file") {

    try {

      const file = importRouteFileInput.files[0];

      if (!validateFileInput(file)) {
        return false;
      }

      data = await processImportedRouteFile(file);

      if (!data || !data.coords) {
        throw new Error(`(IMPORT ROUTE) HTTP Error: ${data}`, {cause: "Sorry, there was an error importing your route."})
      }

      const today = new Date();

      const formattedToday = new Intl.DateTimeFormat('en-GB', {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(today);

      if (!importRouteNameEntry.value) {
        routeName = `${file.name} saved on ${formattedToday}`
      }
      else {
        routeName = importRouteNameEntry.value;
      };
    }
    catch (error) {
      showToast(error.cause || "Sorry, there was an error importing your route, please try again later.")
      return;
    }

    try {
      const response = await fetch(window.appConfig.apiSaveRouteUrl, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: data.coords,
          type: "import",
          route_name: routeName
        }),
      });

      const result = await response.json();

      if (response.status === 422) {
        throw new Error(`(IMPORT ROUTE) Incorrect Imput Error : ${result}`, { cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      if (!response.ok) {
        throw new Error(`(IMPORT ROUTE) HTTP Error: ${result}`, {cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      if (!result.success) {
        throw new Error(`(IMPORT ROUTE) Error: ${result}`, {cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      displayImportedRouteCard(result);
      removeDOMElement(noRouteCardDiv);
      cancelRouteImport();
      return true;

    } catch (err) {
      showToast(err.cause || "Sorry, there was an error importing your route, please try again later.");
    }
  }
  else if (selectedInputType === "url") {
    const url = importRouteURLInput.value.trim();

    if (!URL.canParse(url)) {
      showToast("Please enter a valid URL to import.");
      return false;
    }

    clearImportRouteInput();
    return url;
  }
}

/**
 * Validates the import route input.
 */
export function validateFileInput(file: File | undefined): boolean {

  try {

    const fileName = file?.name;

    // this checks if a file is selected
    if (!file) {
      throw new Error("Validation Error", {cause : "Please select a file to import."});
    }

    // this checks if the file is of the correct type
    if (!allowedFileTypes.some(type => fileName.endsWith(type))) {
      throw new Error("Validation Error", {cause : "Please select a valid file to import."});
    }

    // this checks if the file size is too large (greater than 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Validation Error", {cause : "File is too large. Please select a file smaller than 5MB."});
    }

    // this checks if the file is empty or not
    if (file.size === 0) {
      throw new Error("Validation Error", {cause : "The chosen file is empty, please choose a different file."});
    }

    return true;
  }
  catch (error) {
    throw new Error(error.message, {cause: error.cause || "Sorry, there was an error validating your file, please try again later."})
  }
}

/**
 * Returns the currently selected input type for route import.
 */
function whichInputTypeSelected(): string | null {
    const selectedInputType = document.querySelector('input[name="import-route-method"]:checked');

    if (selectedInputType === fileInputType) {
        return "file";
    }
    else if (selectedInputType === URLInputType) {
        return "url";
    }
    else {
        return null;
    }
}

/**
 * Function responsible for clearing the import route input fields.
 */
function clearImportRouteInput() {
  importRouteFileInput.value = "";
  importRouteURLInput.value = "";
  importRouteNameEntry.value = "";
}

/**
 * Function responsible for clearing and closing the import route panel when the cancel button is clicked.
 */
export function cancelRouteImport() {
    clearImportRouteInput();
    closeImportRoute();
};

/**
 * Function responsible for displaying the correct input type when the selected input type in the input type radio pill choices changes.
 */
export function handleRouteImportType() {

    // this gets the content of the different input types
    const fileInputTypeContent = document.getElementById('import-route-file-row');
    const URLInputTypeContent = document.getElementById('import-route-url-row');

    // this gets the currently selected import type
    const selectedInputType = document.querySelector('input[name="import-route-method"]:checked');

    clearImportRouteInput();

    // this compares against one and displays the corresponding input type
    if (selectedInputType === fileInputType) {
        fileInputTypeContent.style.display = 'flex';
        URLInputTypeContent.style.display = 'none';
    }
    else {
        fileInputTypeContent.style.display = 'none';
        URLInputTypeContent.style.display = 'flex';
    }
}

//#endregion
//#region SAVE ROUTE PANEL

export function toggleSaveRouteContainer() {
  const isOpen = saveRouteToggleButton.classList.toggle("opened");

    if (isOpen) {
        saveRouteDiv.style.height = `${saveRouteDiv.scrollHeight}px`;
    } else {
        saveRouteDiv.style.height = "0px";
    }
};

export function collapseSaveRouteContainer() {
  if (saveRouteToggleButton) {
    saveRouteToggleButton.classList.remove("opened");
  }

  if (saveRouteDiv) {
    saveRouteDiv.style.height = "0px";
  }
}

export function updateSaveRouteContainer() {
  collapseSaveRouteContainer();

  return true;
}

//#endregion
