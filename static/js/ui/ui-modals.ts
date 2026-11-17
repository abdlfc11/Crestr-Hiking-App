// IMPORTS

import { showToast, showModal, closeModals, addClickListener, closeModalUponOutsideClick } from "../utils/ui-utils.js";

import { getCurrentMode } from "../routes/routeState.js";

import {
  homeButtonFunction,
  undoManualRoutePoint,
  redoManualRoutePoint,
  handleLoadCachedRoute,
  selectedPoint,
  deselectSelectedPoint
} from "./ui-routing.js";

import {
  closePanels,
  openSavedRoutesDash,
  closeSavedRoutesDash,
  openSettings,
  closeSettings,
  openImportRoute,
  closeImportRoute
} from "./ui-panels.js";

import { formatDistance } from "../utils/format-utils.js";
import localforage from "localforage";
import { deleteSavedPoint } from "../saved_points/savedPoints.js";

// HTML ELEMENTS

// Delete route modal
export const deleteRouteModal = document.getElementById("delete-route-confirmation-dialog") as HTMLDialogElement | null;
const deleteRouteModalNameDisplay = document.getElementById("delete-route-dialog-name-display");
export const deleteRouteModalDeleteButton = document.getElementById("route-delete-delete-button");
export const deleteRouteModalExitButton = document.getElementById("route-delete-exit-button");
export const deleteRouteModalContent = deleteRouteModal.querySelector(".modal-content");

// Saved point deletion modal
export const deletePointModal = document.getElementById("delete-point-confirmation-dialog") as HTMLDialogElement | null;
export const deletePointModalNameDisplay = document.getElementById("point-name-display");
export const deletePointModalDeleteButton = document.getElementById("point-delete-delete-button");
export const deletePointModalExitButton = document.getElementById("point-delete-exit-button");
export const deletePointModalContent = deletePointModal.querySelector(".modal-content");

// Login modal
export const loginModal = document.getElementById('login-dialog') as HTMLDialogElement | null;
export const loginModalLoginButton = document.getElementById('login-dialog-login');
export const loginModalExitButton = document.getElementById('login-dialog-exit');
export const loginModalContent = loginModal.querySelector('.modal-content');

// Report issue modal
export const reportIssueModal = document.getElementById('report-issue-dialog') as HTMLDialogElement | null;
export const reportIssueModalSubmit = document.getElementById('report-issue-dialog-submit') as HTMLButtonElement | null;
export const reportIssueModalExit = document.getElementById('report-issue-dialog-exit');
export const reportIssueTitleInput = document.getElementById("report-issue-title") as HTMLInputElement | null;
export const reportIssueTextAreaInput = document.getElementById("report-issue-description") as HTMLTextAreaElement | null;

// Donate modal
const donateModal = document.getElementById('donate-modal') as HTMLDialogElement | null;
const donateModalOpenButton = document.getElementById("donate-button");
const donateModalContent = document.getElementById('donate-modal-content');
const donateModalCloseButton = document.getElementById('donate-modal-close-button');
const donateModalMaybeLaterButton = document.getElementById('donate-modal-maybe-later-button');

// Last loaded route modal
export const loadLastRouteModal = document.getElementById('load-last-route-dialog') as HTMLDialogElement | null;
export const loadLastRouteModalContent = loadLastRouteModal.querySelector('.modal-content');
const loadLastRouteModalRouteName = document.getElementById('load-last-route-modal-route-name');
const loadLastRouteModalRouteDistance = document.getElementById('load-last-route-modal-route-distance');
const loadLastRouteModalRouteElevationGain = document.getElementById('load-last-route-modal-route-elevation-gain');
export const loadLastRouteModalLoadButton = document.getElementById('load-last-route-dialog-load-button');
export const loadLastRouteModalDismissButton = document.getElementById('load-last-route-dialog-dismiss-button');

// Save point and save route modals
export const savePointModal = document.getElementById('save-point-dialog') as HTMLDialogElement | null;
export const savePointModalContent = savePointModal.querySelector('.modal-content');
export const savePointModalCloseButton = document.getElementById('save-point-dialog-close');
const mobileSaveRouteButton = document.getElementById("mobile-save-route-button");


export const saveRouteModal = document.getElementById('save-route-dialog') as HTMLDialogElement | null;
export const saveRouteModalContent = saveRouteModal.querySelector('.modal-content');
export const saveRouteModalCloseButton = document.getElementById('save-route-dialog-close');

// Keyboard shortcuts and route-sharing modals
export const shortcutsModal = document.getElementById('shortcuts-dialog') as HTMLDialogElement | null;
export const shortcutsModalContent = shortcutsModal.querySelector('.modal-content');
export const shortcutsModalCloseButton = document.getElementById('shortcuts-dialog-close-button');

export const shareRouteModal = document.getElementById('share-route-dialog') as HTMLDialogElement | null;
export const shareRouteModalContent = shareRouteModal.querySelector('.modal-content');
export const shareRouteModalExitButton = document.getElementById('share-route-dialog-exit-button');

// HTML elements used in keyboard shortcuts
const searchEntry = document.getElementById("search-entry") as HTMLInputElement | null;
const savedRoutesDashContent = document.getElementById("saved-routes-dashboard");
const importRoutePanel = document.getElementById("import-route-panel");
const settingPanel = document.getElementById("settings-panel");

// Keyboard Shortcuts

export function handleModalShortcut(e: KeyboardEvent, modal: HTMLDialogElement) {
  e.preventDefault();
  closePanels();

  if (modal.open) {
    modal.close();
  } else {
    closeModals();
    showModal(true, modal);
  }

}

export function handleKeyboardShortcuts(e: KeyboardEvent) {
  if (document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA") {
    return;
  }

  const key = e.key.toLowerCase();
  const mode = getCurrentMode();

  if (e.ctrlKey || e.metaKey) {
    appShortcuts(e, key);
    if (mode === "manual") {
      manualRouteShortcuts(e, key);
    }
  } else {
    navigationShortcuts(e, key);
  }
}

function appShortcuts(e: KeyboardEvent, key: string) {
  const isModifier = e.metaKey || e.ctrlKey;

  if (isModifier && e.shiftKey && key === "h") {
    e.preventDefault();
    homeButtonFunction();
    return;
  }

  if (isModifier && e.shiftKey && key === "k") {
    e.preventDefault();
    searchEntry?.focus();
  }
}

function manualRouteShortcuts(e: KeyboardEvent, key: string) {
  if (key === "z") {
    e.preventDefault();
    undoManualRoutePoint();
    return;
  }

  if (key === "y") {
    e.preventDefault();
    redoManualRoutePoint();
  }
}

function navigationShortcuts(e: KeyboardEvent, key: string) {
  if (key === "1") {
    handlePanelShortcut(e, savedRoutesDashContent, openSavedRoutesDash, closeSavedRoutesDash);
    return;
  }
  if (key === "2") {
    handlePanelShortcut(e, importRoutePanel, openImportRoute, closeImportRoute);
    return;
  }
  if (key === "3") {
    handlePanelShortcut(e, settingPanel, openSettings, closeSettings);
    return;
  }
  if (key === "4") {
    handleModalShortcut(e, reportIssueModal);
    return;
  }
  if (key === "5") {
    handleModalShortcut(e, donateModal);
    return;
  }
  if (key === "6") {
    handleModalShortcut(e, shortcutsModal);
  }
}

function handlePanelShortcut(
  e: KeyboardEvent,
  panel: HTMLElement | null,
  open: () => void,
  close: () => void
) {
  e.preventDefault();

  if (loginModal.open) {
    loginModal.close();
    return;
  }

  closeModals();
  if (panel?.style.width === "100vw") {
    close();
  } else {
    closePanels();
    open();
  }
}

// Login Modal

/**
 * Toggles the login modal display and sets the action context
 */
export function showLoginModal(show: boolean, actionName = 'perform this action') {
  const messageElement = loginModal.querySelector('.modal-body p');

  if (show) {

    // This updates the message dynamically
    messageElement.textContent = `An account is required to ${actionName}.`;
    loginModal.showModal();
  }
  else {
    loginModal.close();
  }
};

/**
 * Redirects user to login page from login modal
 */
export function loginModalLogin() {
  showLoginModal(false);
  window.location.href = '/login-page';
  return;
};


// Report Issue Modal

/**
 * Cleans and displays the Report Issue Modal
 */
export function showReportIssueModal(show: boolean) {
  if (!reportIssueModal) return;
  if (show) {
    reportIssueModal.showModal();
  } else {
    reportIssueModal.close();
    reportIssueTitleInput.value = "";
    reportIssueTextAreaInput.value = "";
  }
}

/**
 * Validates the input fields for the report issue form.
 */
function validateReportIssueInput(title: string, description: string): boolean {
    if (!title || !description) {
        showToast("Please fill in both the title and description fields.", "error", reportIssueModal);
        return false;
    }

    if (title.length > 100) {
        showToast("Title cannot exceed 100 characters.", "error", reportIssueModal);
        return false;
    }

    if (description.length > 1000) {
        showToast("Description cannot exceed 1000 characters.", "error", reportIssueModal);
        return false;
    }

    return true;
}

/**
 * Handles the submission of the report issue form.
 * Validates the input fields and sends a POST request to the server with the title and description of the issue.
 */
export async function handleReportIssueSubmission(title: string, description: string) {

    if (!validateReportIssueInput(title, description)) {
        return;
    }

    // This disables the submit button to prevent multiple submissions
    reportIssueModalSubmit.disabled = true;

    try {
      const response = await fetch(window.appConfig.apiReportIssueUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title,
          description: description
        })
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error("There was an unexpected error whilst submitting the issue report.")
      }

      if (!data.success) {
          throw new Error("There was an unexpected error whilst submitting the issue report.");
      }

      showToast("Thank you, the issue was reported successfully. ", "success")

      // UI cleanup
      reportIssueTitleInput.value = '';
      reportIssueTextAreaInput.value = '';
      showReportIssueModal(false);

    } catch (error) {
      showToast("There was an unexpected error whilst submitting the issue report.", "error", reportIssueModal);
    } finally {
      reportIssueModalSubmit.disabled = false;
    }
}

// Delete Route Modal

/**
 * Sets the route name label in the Delete Route Modal to the passed in string
 */
export function populateDeleteRouteModal(routeName: string) {
  deleteRouteModalNameDisplay.textContent = routeName;
}

/**
 * Returns a promise containing the user's decision to delete a route in the form of a boolean
 */
export async function waitForDeleteRouteConfirmation(): Promise<boolean> {
  const check = await new Promise<boolean>((resolve) => {

    showModal(true, deleteRouteModal);

    deleteRouteModalDeleteButton.onclick = () => {
      resolve(true);
    }

    deleteRouteModal.onclose = () => {
      resolve(false);
    }

  })

  showModal(false, deleteRouteModal);
  return check;
}

/**
 * Clears the route name label in the Delete Route Modal
 */
export function cleanDeleteRouteModal() {
  deleteRouteModalNameDisplay.textContent = "";
}

//#endregion

// Load Last Route Modal

/**
 * Updates the informative labels of the Last Loaded Route Modal to the passed in strings / fallbacks
 */
export function populateLastLoadedRouteModal(routeStats: RouteStats, routeName: string) {
  loadLastRouteModalRouteName.textContent = routeName;
  loadLastRouteModalRouteDistance.textContent = formatDistance(Number(routeStats.total_distance))
  loadLastRouteModalRouteElevationGain.textContent = `${routeStats.elevation_gain} m`
}

// Initialisation

export function initModals() {

  function bindModal(
    modal: HTMLDialogElement | null,
    content: Element | null,
    closeBtn: HTMLElement | null
  ) {
    addClickListener(closeBtn, () => showModal(false, modal), "click");
    addClickListener(modal, (e) => closeModalUponOutsideClick(e, content, modal), "click");
  }

  // Standard close + outside click event listeners
  bindModal(deletePointModal, deletePointModalContent, deletePointModalExitButton);
  bindModal(deleteRouteModal, deleteRouteModalContent, deleteRouteModalExitButton);
  bindModal(loginModal, loginModalContent, loginModalExitButton);
  bindModal(savePointModal, savePointModalContent, savePointModalCloseButton);
  bindModal(saveRouteModal, saveRouteModalContent, saveRouteModalCloseButton);
  bindModal(donateModal, donateModalContent, donateModalCloseButton);
  bindModal(shortcutsModal, shortcutsModalContent, shortcutsModalCloseButton);
  bindModal(shareRouteModal, shareRouteModalContent, shareRouteModalExitButton);
  bindModal(reportIssueModal, null, reportIssueModalExit)

  bindModal(loadLastRouteModal, loadLastRouteModalContent, null);

  // Delete Point Modal
  addClickListener(deletePointModal, deselectSelectedPoint, "close");
  addClickListener(deletePointModalDeleteButton, () => deleteSavedPoint(selectedPoint), "click");

  // Login Modal
  addClickListener(loginModalLoginButton, loginModalLogin, 'click');

  // Save Route Modal
  addClickListener(mobileSaveRouteButton, () => showModal(true, saveRouteModal), "click")

  // Report Issue Modal
  addClickListener(reportIssueModalExit, () => showReportIssueModal(false), "click");
  addClickListener(reportIssueModalSubmit, () => handleReportIssueSubmission(reportIssueTitleInput.value.trim(), reportIssueTextAreaInput.value.trim()), "click");

  // Donate Modal
  addClickListener(donateModalCloseButton, () => showModal(false, donateModal), "click");
  addClickListener(donateModalMaybeLaterButton, () => showModal(false, donateModal), "click");
  addClickListener(donateModalOpenButton, () => showModal(true, donateModal), "click");
  addClickListener(donateModal, (e) => closeModalUponOutsideClick(e, donateModalContent, donateModal), "click");

  // Load Last Route Modal
  addClickListener(loadLastRouteModalDismissButton, () => {
    showModal(false, loadLastRouteModal);
    localforage.clear();
  }, "click");
  addClickListener(loadLastRouteModalLoadButton, handleLoadCachedRoute, "click");
  addClickListener(loadLastRouteModal, (e) => closeModalUponOutsideClick(e, loadLastRouteModalContent, loadLastRouteModal), "click");

  // Keyboard Shortcuts Modal
  addClickListener(shortcutsModalCloseButton, () => showModal(false, shortcutsModal), "click");
  addClickListener(shortcutsModal, (e) => closeModalUponOutsideClick(e, shortcutsModalContent, shortcutsModal), "click");

  // Share Route Modal
  addClickListener(shareRouteModalExitButton, () => showModal(false, shareRouteModal), "click");
  addClickListener(shareRouteModal, (e) => closeModalUponOutsideClick(e, shareRouteModalContent, shareRouteModal), "click");
  addClickListener(document, handleKeyboardShortcuts, "keydown");
}
