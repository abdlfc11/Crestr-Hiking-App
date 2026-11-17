// This file's purpose is to define the initialisation of the mobile routing + navigation buttons
// This is then exported to ui-initialisation.ts where it is used in the initUI() orchestrator function

// Imports

import { addClickListener, showModal } from "../utils/ui-utils";
import { openImportRoute, openSavedRoutesDash, openSettings } from "./ui-panels";
import { clearManualRoute, redoManualRoutePoint, undoManualRoutePoint } from "./ui-routing";

// HTML Elements

// Nav Buttons
const mobileNavButton = document.getElementById("mobile-nav-button");
const mobileNavDropdownContent = document.getElementById("mobile-nav-dropdown-content");
const mobileNavSavedRoutes = document.getElementById("mobile-nav-saved-routes");
const mobileNavImportRoutes = document.getElementById("mobile-nav-import-route");
const mobileNavSettings = document.getElementById("mobile-nav-settings");
const mobileNavReportBug = document.getElementById("mobile-nav-report-bug");
const mobileNavDonate = document.getElementById("mobile-nav-donate");

// Action Buttons
const mobileActionsButton = document.getElementById("mobile-actions-button");
const mobileActions = document.getElementById("mobile-actions");
const mobileUndoAction = document.getElementById("mobile-undo-button");
const mobileRedoAction = document.getElementById("mobile-redo-button");
const mobileClearAction = document.getElementById("mobile-clear-button");
const mobileAttributionButton = document.getElementById("mobile-attribution-button");
const mobileAttributions = document.getElementById("mobile-attributions");

// Modals
const donateModal = document.getElementById('donate-modal') as HTMLDialogElement | null;
const reportIssueModal = document.getElementById('report-issue-dialog') as HTMLDialogElement | null;

// Initialisation

export function initMobile() {

  // These event listeners are for the mobile nav
  addClickListener(mobileNavButton, () => mobileNavDropdownContent.classList.toggle('show'), "click");
  addClickListener(mobileNavDonate, () => showModal(true, donateModal), "click");
  addClickListener(mobileNavReportBug, () => showModal(true, reportIssueModal), "click");
  addClickListener(mobileNavSettings, openSettings, "click");
  addClickListener(mobileNavImportRoutes, openImportRoute, "click");
  addClickListener(mobileNavSavedRoutes, openSavedRoutesDash, "click");

  // These event listeners are for mobile routing actions
  addClickListener(mobileActionsButton, () => {
    const isOpen = mobileActions.classList.toggle("show");
    mobileActionsButton.setAttribute("aria-expanded", String(isOpen));
    mobileActionsButton.setAttribute("aria-label", isOpen ? "Hide route actions" : "Show route actions");
  }, "click")

  addClickListener(mobileClearAction, clearManualRoute, "click")
  addClickListener(mobileUndoAction, undoManualRoutePoint, "click")
  addClickListener(mobileRedoAction, redoManualRoutePoint, "click");
  addClickListener(mobileAttributionButton, () => {
    const isOpen = mobileAttributions.classList.toggle("show");
    mobileAttributionButton.setAttribute("aria-expanded", String(isOpen));
    mobileAttributionButton.setAttribute("aria-label", isOpen ? "Hide map attributions" : "Show map attributions");
  }, "click");
}
