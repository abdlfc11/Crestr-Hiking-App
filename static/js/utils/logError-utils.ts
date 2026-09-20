
/**
 * Logs error details and performance telemetry to the DB in the backend
 */
export function logError(action: string, info: unknown, durationMs: number | null = null,errorCode: string | number | null = null) {

    try { 
        fetch(window.appConfig.apiLogErrorUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                outcome: false,
                info: info,
                duration_ms: durationMs,
                error_code: errorCode
            }),
        })
    }
    catch(error) {
        console.log("ERROR WHILST ATTEMPTING TO LOG ERROR : ", error)
    }
}
