import { toLonLat } from "ol/proj.js";
import { formatLatLon } from "../utils/routing-utils.js";
import { getMap } from "../map.js";
import { saveNewPoint } from "../saved_points/savedPoints.js";
import { showToast } from "../utils/ui-utils.js";
import { ERROR_MESSAGES } from "../utils/error-constants.js";

const popup = document.getElementById('map-context-menu');

const saveButton = document.getElementById('map-context-save-point');
const savePointModal = document.getElementById('save-point-dialog') as HTMLDialogElement | null;
const savePointModalInput = document.getElementById('save-point-dialog-name-input') as HTMLInputElement | null;
const savePointModalSaveButton = document.getElementById('save-point-dialog-save');

const copyCoordinateButton = document.getElementById('map-context-copy-coordinate');

// Menu item functions

function handleCoordinateCopy(coordinate: number[] | null) {
  if (!coordinate) {
    console.error("ERROR (handleCoordinateCopy()) : Invalid / no coordinate passed in. ");
    return;
  }

  const lonLat = formatLatLon(toLonLat(coordinate), 6);

  navigator.clipboard.writeText(lonLat).then(
    () => {
      return;
    },
    () => {
      showToast("Sorry, there was an unexpected error copying this coordinate to the clipboard");
    }
  );
}

/**
 * Adds right-click behaviour to the options context menu / popup
 */
export function initMapContextMenu() {

  const map = getMap();
  if (!map) return; 

  const viewport = map.getViewport();
  if (!viewport || !popup || !saveButton || !copyCoordinateButton) return;

  let coordinate: number[] | null = null;

  // Helper functions

  const closePopup = () => {
    popup.hidden = true;
  };

  const resetCoordinate = () => {
    coordinate = null;
  }

  const positionPopup = (event: MouseEvent) => {
    const popupRect = popup.getBoundingClientRect();
    const gap = 8;
    const maxLeft = Math.max(gap, window.innerWidth - popupRect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - popupRect.height - gap);

    popup.style.left = `${Math.min(Math.max(gap, event.clientX), maxLeft)}px`;
    popup.style.top = `${Math.min(Math.max(gap, event.clientY), maxTop)}px`;
  };

  viewport.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    coordinate = map.getEventCoordinate(event);
    popup.hidden = false;
    positionPopup(event);
  });


  // Event Listeners 

  saveButton.addEventListener('click', () => {
    closePopup();
    savePointModal.show();
  })

  savePointModalSaveButton.addEventListener('click', async () => {
    try {
      const pointName = savePointModalInput.value.trim();

      if (pointName === "") {
        throw new Error("ERROR (saveNewPoint()) : Invalid name given (empty)", {cause : "Please enter a name."});
      } else if (!pointName) {
        throw new Error("ERROR (saveNewPoint()) : Invalid name given (generic)", {cause : "There was an unexpected error, enter a different name or try again leter."});
      }

      await saveNewPoint(coordinate, pointName);

      savePointModal.close();
      savePointModalInput.value = "";
      
      resetCoordinate();
    } catch (error) {
      console.error(error.message);
      showToast(error.cause || ERROR_MESSAGES.ROUTING.GENERIC_SAVE_ROUTE)
    }
  })

  copyCoordinateButton.addEventListener('click', () => {
    closePopup();
    handleCoordinateCopy(coordinate);
    resetCoordinate();
  })

  document.addEventListener("pointerdown", (event) => {
    if (!popup.hidden && !popup.contains(event.target as Node)) {
      closePopup();
      resetCoordinate();
    };
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) {
      event.preventDefault();
      closePopup();
      resetCoordinate();
    };
  });
}
