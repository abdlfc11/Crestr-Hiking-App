/**
 * settingsState.ts
 * Central in-memory + persisted (localStorage + server) store for user app preferences.
 * Supports `distanceUnit` ("km" | "miles"), Theme {dark, light and system}
 * Other modules import getAppSettings() for read-only access (e.g. formatDistance).
 *
 * @module settingsState
 */

let appSettings: AppSettings = {
  distanceUnit: "km",
  theme: "system"
};

/**
 * Hydrate from localStorage (sync, used for instant UI before server round-trip).
 * Falls back to previous "distanceUnit" key for backward compatability
 */
function hydrateFromLocalStorage() {
  try {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      const parsed = JSON.parse(saved); // this makes a JS Object from the local storage string
      if (parsed) {
        appSettings = { ...appSettings, ...parsed };
        return;
      }
    }
    // legacy key
    const legacy = localStorage.getItem("distanceUnit");
    if (legacy === "miles" || legacy === "km") {
      appSettings.distanceUnit = legacy;
    }
  } catch (e) {
    // ignore corrupt localStorage
  }
}

hydrateFromLocalStorage();

/**
 * Return a clone of current settings. Safe for consumers.
 */
export function getAppSettings(): AppSettings {
  return { ...appSettings };
}

/**
 * Update in-memory state + localStorage. Does NOT touch the server.
 */
export function saveAppSettings(settings: Partial<AppSettings>) {

  if(!settings) return;

  appSettings = { ...appSettings, ...settings };
  try {
    localStorage.setItem("appSettings", JSON.stringify(appSettings));

    if (settings.distanceUnit) {
      localStorage.setItem("distanceUnit", appSettings.distanceUnit);
    }
  } catch (error) {
    // storage full / private mode etc.
    console.error(error.message)
  }
}

/**
 * Asynchronously load preferences from the backend for the logged-in user
 * and merge into local state (server wins for this session).
 */
export async function loadAppSettingsFromServer(): Promise<AppSettings> {
  const url = window.appConfig && window.appConfig.apiGetSettings;
  if (!url) {
    console.debug("[settingsState] no apiGetSettings configured");
    return getAppSettings();
  }

  // This is to ensure that no errors are thrown when a user is not logged in
  const isLoggedIn = window.appConfig.loggedIn
  if (!isLoggedIn) {
    return getAppSettings();
  }

  try {
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.success && data.settings_dict) {
      const incoming = data.settings_dict;
      if (incoming.distanceUnit === "km" || incoming.distanceUnit === "miles") {
        saveAppSettings({ distanceUnit: incoming.distanceUnit });
      }
      if (incoming.theme === "dark" || incoming.theme === "light" || incoming.theme === "system") {
        saveAppSettings({ theme: incoming.theme });
      }
    }
  } catch (error) {
    console.warn(`ERROR (loadAppSettingsFromServer()) failed to load settings from server: ${error}`);
    // keep whatever we have in memory/local
  }
  return getAppSettings();
}

/**
 * Persist the provided (or current) settings to the backend.
 * Fire-and-forget
 */
export async function saveAppSettingsToServer(settingsDict?: Partial<AppSettings>): Promise<{ success: boolean, message?: string}> | null {

  // This is to ensure that no errors are thrown when a user is not logged in
  const isLoggedIn = window.appConfig.loggedIn
  if (!isLoggedIn) {
    return null;
  }

  const url = window.appConfig.apiSaveSettings;
  if (!url) throw new Error("apiSaveSettings not present in window.appConfig");

  const payload = settingsDict || { ...appSettings };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ settings_dict: payload }),
  });

  if (!res.ok) {
    throw new Error(`Save settings HTTP ${res.status}`);
  };

  return await res.json();
}

// ##### SYSTEM THEME #####

/**
 * returns the correct theme to apply at the time of calling
 */
export function getTheme(): "dark" | "light" {
  if (appSettings.theme !== "system") {
    return appSettings.theme
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return "dark"; 
    } else {
      return "light"
    }
  }
} 

/**
 * Returns the current distance unit preference.
 */
export function getDistanceUnit(): DistanceUnit {
  return appSettings.distanceUnit;
}
