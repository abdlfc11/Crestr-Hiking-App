/**
 * This file is intended to hold all UI related helper functions
 * As of August 2026 this file hold the following functions:
 *      
 *      - showToast(message, type = "error", modal = null)
 *      - addClickListener(element, func, type)
 *      - removeDOMElement(element)
 *      - createRouteCard(routeName, formattedDate, distanceInKm, ETA, elevDisplayValue)
 *      - createNoRouteCard()
 *      - createStatsPanel(distanceDisplay, etaDisplay, elevationGain)
 *      - parseCoordString(value)
 *      - closeModalUponOutsideClick(e, modalContent, modal)
 *      - showModal(show, modal)
 *      - closeModals()
 */
      



//#region GENERAL 

/**
 * Parses a coordinate string in the form "X, Y" (or "X,Y")
 * Returns [x, y] as numbers or null if the format is invalid
 * Never throws
 */
export function parseCoordString(value: string): number[] | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s*,\s*/);
  if (parts.length !== 2) return null;

  const x = Number(parts[0]);
  const y = Number(parts[1]);

  if (!x || !y) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return [x, y];
}

type ToastType = "error" | "success" | "warning" | "info";
/**
 * Shows a toast notification 
 */
export function showToast( message: string, type: ToastType = "error", modal: HTMLDialogElement | boolean | null = null) {

    // this defines the status icons
    const icons = {
        error: "!",
        success: "\u2713",
        warning: "!",
        info: "i",
    };

    // this defines the titles per toast type 
    const titles = {
        error: "Error",
        success: "Success",
        warning: "Warning",
        info: "Info",
    };

    // this retrieves the modal element (if any) 
    let modalElement = null;

     if (modal instanceof HTMLElement) {
        modalElement = modal;
    }

    // this determines the container i.e within a modal or the main app
    let container: HTMLElement | null;

    if (modalElement) {
        // this finds or creates the container 
        container = modalElement.querySelector(".toast-container--modal");

        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container--modal";
            modalElement.appendChild(container);
        }
    } else {
        container = document.getElementById("error-toast-container");
    }

    if (!container) {
        console.warn("showToast: no toast container found");
        return;
    }

    // this builds the toast element 
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("data-type", type);
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    // this defines the status icon
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = icons[type] || icons.error;
    icon.setAttribute("aria-hidden", "true");

    // this defines the content (title + message)
    const content = document.createElement("div");
    content.className = "toast-content";

    const titleElement = document.createElement("span");
    titleElement.className = "toast-title";
    titleElement.textContent = titles[type] || titles.error;

    const messageElement = document.createElement("span");
    messageElement.className = "toast-message";
    messageElement.textContent = String(message);

    content.appendChild(titleElement);
    content.appendChild(messageElement);

    // this defines the dismisses (X) button
    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.innerHTML = "&times;";

    // this defines the auto-dismiss progress bar
    const progress = document.createElement("div");
    progress.className = "toast-progress";

    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeButton);
    toast.appendChild(progress);
    container.appendChild(toast);

    // this makes the popup hide after 3s
    const hideTimeout = setTimeout(removeToast, 3000);

    // Helper to remove the toast (used by both the timeout and the close button)
    function removeToast() {
        clearTimeout(hideTimeout);
        toast.classList.add("hide");
        toast.classList.remove("show");

        // this removes it from the DOM once the hide animation is done
        setTimeout(() => {
            toast.remove();
            // this cleans up a modal-scoped container if it is empty
            if (container.classList.contains("toast-container--modal") && container.childElementCount === 0) {
                container.remove();
            }
        }, 300);
    } 

    // this triggers the slide-in animation of the toast
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    closeButton.addEventListener("click", removeToast);
}

//#endregion

//#region DOM RELATED

/**
 * Used to quickly add an event listener to skip the if statement 
 */
export function addClickListener(element: EventTarget | null, func: EventListenerOrEventListenerObject, type: string) {
  if (element) element.addEventListener(type, func);
}

/**
 * Removes the passed in DOM element
 * Used in any feature which adds a route card to the saved routes dashboard as it is used to remove the <div>...</div> content which tells the user that they have not saved any routes
 */
export function removeDOMElement(element: HTMLElement | null): boolean {
  if (element) {
    element.remove()
    return true;
  }
  else {
    return false;
  }
}


/**
 * Replaces any character within passed in string that interfere with HTML and returns the edited string
 */
function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&`#39`;"
  };
  return String(value).replace(/[&<>"']/g, (character) => replacements[character]);
}

/**
 * Generates the HTML string for a saved route card displayed in the UI.
 */
export function createRouteCard(routeName: string, formattedDate: string, distanceInKm: number, formattedDistance: string, ETA: string, elevDisplayValue: string): string {
    const safeRouteName = escapeHtml(routeName)

    return `<div class="route-card" data-route-name="${safeRouteName}">
                                <div class="route-card-header">
                                    <h3 class="route-card-name">${safeRouteName}</h3>
                                    <span class="route-card-date">Saved on ${formattedDate}</span>
                                </div>
                                <div class="route-card-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Distance:</span>
                                        <span class="stat-value" data-distance-km="${distanceInKm}">${formattedDistance}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">ETA:</span>
                                        <span class="stat-value">${ETA}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Elevation Gain:</span>
                                        <span class="stat-value">${elevDisplayValue}</span>
                                    </div>
                                </div>
                                <div class="route-card-actions">
                                    <button type="button" class="route-btn route-btn-delete">Delete</button>
                                    <button type="button" class="route-btn route-btn-download-gpx">GPX</button>
                                    <button type="button" class="route-btn route-btn-download-geojson">GeoJSON</button>
                                    <button type="button" class="route-btn route-btn-load">Load</button>
                                </div>
                            </div>
                            `;
    }

/**
 * Returns a card showing users that there are no saved routes 
 */
export function createNoRouteCard(): string {
  return `<div id="no-routes-wrapper" class="no-routes-wrapper">
              <div class="no-routes-card">
                  <h2 class="no-routes-title">No routes saved yet</h2>
                  <p class="no-routes-description">
                      You haven’t created any routes. Start planning your next adventure below.
                  </p>
                  <button id="no-route-create-button" class="no-routes-create-btn generate-button">
                      Create a route
                  </button>
              </div>
          </div>`
}

/**
 * Returns a stats panel showing key details of the currently-displayed route 
 */
export function createStatsPanel(distanceDisplay: string, etaDisplay: string, elevationGain: string): string {

    const elevationGainDisplay = elevationGain == "+0 m" ? "No Data" : elevationGain

    return `
        <div class="stats-header">
            <span class="stats-title">Route Information</span>
            <button id="toggle-elevation-chart" class="stats-button">Elevation Profile</button>
        </div>
        <div id="stat-content-and-chart-container">
            <div class="stats-content">
                <div class="stat-row">
                    <span class="stat-label">Distance:</span>
                    <span class="stat-value" id="route-distance-display">${distanceDisplay}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">ETA:</span>
                    <span class="stat-value" id="route-eta-display">${etaDisplay}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Elevation Gain:</span>
                    <span class="stat-value" id="route-elevation-gain-display">${elevationGainDisplay}</span>
                </div>
            </div>

            <div class="chart-wrapper"> 
                <div id="elevation-chart-container">
                    <canvas id="elevation-chart"></canvas>
                </div>
            </div>
        </div>
    `
}

//#endregion

//#region MODALS

/**
 * Catches clicks outside of a modal in order to close the modal upon these clicks. 
 */
export function closeModalUponOutsideClick(e: Event, modalContent: Element | null, modal: HTMLDialogElement) {
  if (modalContent && !modalContent.contains(e.target as Node)) {
      modal.close()
    }
};

/**
 * Toggles the provided modal
 */
export function showModal(show: boolean, modal: HTMLDialogElement) {
  if (show) {
    modal.showModal();
  }
  else {
    modal.close();
  }
};

/**
 * Closes all modals within the application
 */
export function closeModals() {

    const modals = [
        document.getElementById('save-point-dialog') as HTMLDialogElement,
        document.getElementById('shortcuts-dialog') as HTMLDialogElement,
        document.getElementById('load-last-route-dialog') as HTMLDialogElement,
        document.getElementById('donate-modal') as HTMLDialogElement,
        document.getElementById('report-issue-dialog') as HTMLDialogElement,
        document.getElementById('login-dialog') as HTMLDialogElement,
        document.getElementById("delete-point-confirmation-dialog") as HTMLDialogElement
    ]

    modals.forEach(modal => {
        modal.close();
    })
}

//#endregion
