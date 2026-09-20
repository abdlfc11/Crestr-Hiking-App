//#region Imports

import { showToast } from "../utils/ui-utils.js";

import { 
  validatePassword,
  validateRegisterInput,
  clearRegisterEntries
} from "./helpers.js";

import {
  addClickListener
} from "../utils/ui-utils.js"

//#endregion

//#region Variables / Constants

// Login elements
const loginValidationLabel = document.getElementById("login_validation_label");
const loginUsernameEntry = document.getElementById("login_username_entry") as HTMLInputElement | null;
const loginPasswordEntry = document.getElementById("login_password_entry") as HTMLInputElement | null;
const loginButton = document.getElementById("login_button");
const logoutButton = document.getElementById("logout-button");
const switchToRegisterButton = document.getElementById("switch_to_register_button");

// Registering elements
const switchToLoginButton = document.getElementById("register-switch-to-login-button")
const registerButton = document.getElementById("register-button");
const registerPasswordEntry1 = document.getElementById("register-password-entry1") as HTMLInputElement | null;
const registerPasswordEntry2 = document.getElementById("register-password-entry2") as HTMLInputElement | null;
const registerUsernameEntry = document.getElementById("register-username-entry") as HTMLInputElement | null;
const registerPreferredNameEntry = document.getElementById("register-preferred-name-entry") as HTMLInputElement | null;

// icon elements
const icons = document.querySelectorAll<HTMLElement>(".fa-eye");

// deleting elements
const deleteAccountButton = document.getElementById("delete-user-button");

//#endregion

//#region NAVIGATION

function switchToLogin() {
  window.location.href = '/login-page';
}

export function switchToRegister() {
  window.location.href = "/register-page";
}

//#endregion

//#region REGISTERING

async function register() {
  const username = registerUsernameEntry.value;
  const password1 = registerPasswordEntry1.value;
  const password2 = registerPasswordEntry2.value;
  const preferredName = registerPreferredNameEntry.value;

  const message = validateRegisterInput(username, password1, password2);

  if (message !== true) {
    showToast(message, "error", null);
    return;
  };

  try { 

    console.log("ENTERING FETCH")

    const response = await fetch(apiRegisterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferred_name: preferredName,
        username: username,
        password1: password1,
        password2: password2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message, "error", null);
      return;
    };

    if (data.success) {
      clearRegisterEntries(registerUsernameEntry, registerPasswordEntry1, registerPasswordEntry2);
      window.location.href = 'https://crestr.co.uk';
    } else {
      showToast(data.message, "error", null);
    }
} catch (error) {
    console.log(`ERROR: ${error}`);
    showToast(error.message, "error", null);
};

};

//#endregion

//#region LOGIN/LOGOUT

/**
 * Handles user login using entry values 
 */
export async function login() {

  const username = loginUsernameEntry.value;
  const password = loginPasswordEntry.value;
  loginValidationLabel.style.color = "#ff4d4d";

  try { 

    const response = await fetch(apiLoginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: username, password: password }),
    })

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message, "error", null);
      return;
    };

    if (data.success) {
      loginUsernameEntry.value = "";
      loginPasswordEntry.value = "";
      window.location.href = "/map"
    } else {
      showToast(data.message, "error", null);
    }
  } 
  catch(error) {
    console.error("ERROR: ", error);
    showToast(error.message || "Sorry, there was an unexpected error whilst logging in, try again later.")
  }

}

/**
 * Handles user logout 
 */
export function logout() {

  const url = window.appConfig.apiLogoutUrl

  fetch(url, {
    method: "POST",
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        window.location.href = "https://crestr.co.uk";
      }
    });
}

//#endregion

//#region ACCOUNT DELETION

/**
 * 
 * @param skipConfirm 
 * @returns 
 */
export async function deleteAccount(skipConfirm = false) {

  const userConfirmation = skipConfirm || confirm("Are you sure you want to delete your account ? ") // (confirm acts as fallback)

  if (!userConfirmation) {
    return;
  }

  const url = window.appConfig.apiDeleteAccountUrl

  try { 

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(`ERROR (deleteAccount()) : ${data.message || response.status}`, {cause : "There was an unexpected error whilst deleting your account."});
    };

    window.location.href = 'https://crestr.co.uk'; 

  } catch(error) {
    console.error(`ERROR : ${error.message}`); 
    showToast(error.cause); 
  };
}

//#endregion

//#region THEME

function getStoredThemePreference(): ThemePreference {
  const savedSettings: AppSettings = JSON.parse(localStorage.getItem("appSettings"));
  if (!savedSettings) return "system";
  else return savedSettings.theme
}

// Helper to apply the '.dark' class to the document
function setTheme(isDark: boolean) {
    if (isDark) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

function initDarkMode() {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const theme = getStoredThemePreference();


    setTheme(theme === "system" ? darkModeQuery.matches : theme === "dark");

    darkModeQuery.addEventListener("change", (e) => {
      if (getStoredThemePreference() === "system") {
          setTheme(e.matches);
      }
    });
}

//#endregion

//#region INIT
export function initAuth() {

  initDarkMode();

  addClickListener(logoutButton, logout, "click");
  addClickListener(loginButton, login, "click");
  addClickListener(registerButton, register, "click");
  addClickListener(switchToRegisterButton, switchToRegister, "click");
  addClickListener(switchToLoginButton, switchToLogin, "click");
  addClickListener(deleteAccountButton, () => void deleteAccount(), "click");
  addClickListener(registerPasswordEntry1, () => validatePassword(registerPasswordEntry1.value, registerPasswordEntry2.value), "input");
  addClickListener(registerPasswordEntry2, () => validatePassword(registerPasswordEntry1.value, registerPasswordEntry2.value), "input");

  if (window.location.pathname === "/login-page" || window.location.pathname === "/register") {
    if (window.location.pathname === "/login-page") {
      document.addEventListener("keypress", (event) => {
        if (event.key === 'Enter') {
          login()
        }
      });
    }
    else {
      document.addEventListener("keypress", (event) => {
        if (event.key === 'Enter') {
          register()
        }
      });
    }
  };

  // Add event listeners to all password visibility toggle icons
  icons.forEach((icon) => {
    icon.addEventListener("click", (event) => {
      const target = event.currentTarget as HTMLElement;
      const parent = target.parentElement;
      const passwordInput = parent.querySelector<HTMLInputElement>(
        'input[type="password"], input[type="text"]',
      );

      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";

      target.classList.toggle("auth-icon-active", isPassword);
    });
  });
}

//#endregion