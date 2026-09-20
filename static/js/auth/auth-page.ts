/**
 * This file is responsible for being the entrypoint for the auth-central pages: 
 *      - login.html
 *      - register.html
 */

import { initAuth } from "./auth";
import { initIcons } from "../init/icons";

document.addEventListener("DOMContentLoaded", () => {
	initIcons();
	initAuth();
});