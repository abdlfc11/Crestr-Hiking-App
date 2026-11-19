// This file's responsibility is to hold the logic associated with fetching the releases json
// (found at : https://docs.crestr.co.uk/releases.json) and displaying a modal informing of the update if needed

import { releaseDataUrl } from "../constants";
import { addClickListener, showModal } from "../utils/ui-utils";

// Update Modal HTML
const updateModal = document.getElementById('update-dialog') as HTMLDialogElement;
const updateModalInfoButton = document.getElementById('update-dialog-info');
const updateModalVersionText = document.getElementById('update-modal-version');

// Release data types
type HasAccessedApp = boolean | null
type LastSeenUpdate = string | null

type LatestRelease = string
type ChangelogUrl = string
interface ReleaseDataSchema {
  latestRelease: LatestRelease,
  changelogUrl: ChangelogUrl
}

// Helper functions
function waitForUserAcknowledgment() {
  showModal(true, updateModal)

  return new Promise<void>((resolve) => updateModal.onclose = () => resolve());
}

function populateUpdateModal(latestRelease: LatestRelease) {
  updateModalVersionText.textContent = latestRelease;
}

function updateUserInfo(latestRelease: LatestRelease) {
  if (localStorage.getItem("hasAccessedApp") !== 'true') {
    localStorage.setItem("hasAccessedApp", "true");
  };

  localStorage.setItem("lastSeenUpdate", latestRelease);
}

// Init function

function initUpdates(changelogUrl: ChangelogUrl, latestRelease: LatestRelease) {
  addClickListener(updateModalInfoButton, () => {
    showModal(false, updateModal);
    updateUserInfo(latestRelease)
    window.location.href = changelogUrl;
  }, "click");
}

// Main function

export async function checkForUpdate() {

  try {

    // Fetching release data
    const release = await fetch(releaseDataUrl);
    if (!release.ok) throw new Error(`Failed to fetch release data : ${release.status}`);
    const releaseData: ReleaseDataSchema = await release.json();

    // Validation
    if (!releaseData.changelogUrl || !releaseData.latestRelease) throw new Error("Invalid release.json");

    // Initialisation
    initUpdates(releaseData.changelogUrl, releaseData.latestRelease)

    // New users don't need to be notified of an update
    const hasAccessedApp: HasAccessedApp = localStorage.getItem('hasAccessedApp') === 'true' || localStorage.getItem('seenInitialTour') === 'true'
    console.log(localStorage.getItem('seenInitialTour') === 'true');
    console.log(`HAS ACCESSED : ${hasAccessedApp}`);
    if (!hasAccessedApp) {
      updateUserInfo(releaseData.latestRelease);
      return;
    };

    // Fetching last update
    const lastSeenUpdate: LastSeenUpdate = localStorage.getItem("lastSeenUpdate");

    // Update user info needed to migrate legacy users to use the key
    if (lastSeenUpdate === releaseData.latestRelease) {
      updateUserInfo(releaseData.latestRelease);
      return;
    }
    populateUpdateModal(releaseData.latestRelease);
    await waitForUserAcknowledgment();
    updateUserInfo(releaseData.latestRelease)
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(`(checkForUpdate) An unexpected error occurred -> ${error}`)
    }
  }
}
