
import {
    createRouteCard
} from "./utils/ui-utils.js";

import {
    formatDistance,
    formatETA,
    formatElevation
} from "./utils/format-utils.js";

const allRoutesContainer = document.getElementById("all-routes-container");

interface ImportedRouteResponse {
    success: boolean;
    coords?: number[][];
    message?: string;
    user_message?: string;
    route_info?: {
        route_name: string;
        distance_km: number;
        eta_seconds: number;
        elevation_gain_metres: number;
    };
}

export async function processImportedRouteFile(file: File): Promise<ImportedRouteResponse> {

    const form = new FormData();
    form.append("route_file", file);

    const response = await fetch(window.appConfig.apiImportRouteUrl, {
        method: 'POST',
        body: form
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error( data.message || `(IMPORT ROUTE) HTTP Error: ${data}`, {cause: data.user_message || data.message || "Sorry, there was an error importing your route."})
    }

    if (data.success) {
        return data;
    }
    else {
        throw new Error(data.message || "Route import failed");
    }

}

export function displayImportedRouteCard(data: ImportedRouteResponse): void {

    const routeInfo = data.route_info;
    const today = new Date();

    const routeName = routeInfo.route_name

    const formattedToday = new Intl.DateTimeFormat('en-GB', {
        "day": "2-digit",
        "month": "2-digit",
        "year": "numeric"
    }).format(today);

    const distanceKm = routeInfo.distance_km;
    const formattedDistanceKm = formatDistance(distanceKm);
    const formattedETA = formatETA(routeInfo.eta_seconds);
    const formattedElevation = routeInfo.elevation_gain_metres === 0 ? "No Data" : formatElevation(routeInfo.elevation_gain_metres)

    

    const routeCard = createRouteCard(routeName, formattedToday, distanceKm, formattedDistanceKm, formattedETA, formattedElevation);

    if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);            
}
