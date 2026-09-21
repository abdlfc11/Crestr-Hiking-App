import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Creates and returns the tour for the import route panel
 */
export function createImportRoutePanelTour(): Driver {
    return driver({
        popoverClass: 'app-tour-theme',
        showProgress: true,
        steps: [
          {
            popover: {
              title: 'Importing Routes',
              description: 'This is where you can import any of your own routes.'
            }
          },
          {
            element: '#import-route-import-method-row',
            popover: {
              title: 'Importing Routes',
              description: 'You can choose to import your routes via your saved files or via a public URL.'
            }
          },
          {
            element: '#import-route-name-route-row',
            popover: {
              title: 'Importing Routes',
              description: 'It is recommended that you name the imported route, otherwise it will be saved as the filename and date it was saved.'
            }
          },
          {
            element: '#import-route-cancel-button',
            popover: {
              title: 'Importing Routes',
              description: 'Click here if you no longer wish to import your route.'
            }
          },
          {
            element: '#import-route-submit-button',
            popover: {
              title: 'Importing Routes',
              description: 'Click here to import your route once you are finished.'
            }
          }
        ]
    })
}

/**
 * Creates and returns the tour for the saved routes dashboard 
 */
export function createSavedRouteDashboardTour(): Driver {
    return driver({
        popoverClass: 'app-tour-theme',
        showProgress: true,
        steps: [
          {
            popover: {
              title: 'Saved Routes',
              description: 'Here you can view your saved routes where you can download routes in either GeoJSON or GPX, load them, or delete them.'
            }
          }
        ]
    })
}

/**
 * Creates and returns the tour for routing
 */
export function createAutomaticRoutingTour(onTourEnd?: () => void | Promise<void>): Driver {
    return driver({
        popoverClass: 'app-tour-theme',
        showProgress: true,

        onDoneClick: async (element, step, options) => {
            options.driver.destroy();

            if (typeof onTourEnd === 'function') {
                await onTourEnd();
            }
        },
        steps: [
            {
            popover: {
                title: 'Welcome to Crestr',
                description: 'This tour will show you how to build a route and navigate Crestr.'
            }
            },
            {
            element: '#the-sidenav',
            popover: {
                title: 'Navigation',
                description: 'Use the navigation rail on the left to open settings, import routes and access your saved routes dashboard. It expands when you hover over it.'
            }
            },
            {
            element: '#home-button',
            popover: {
                title: 'Resetting the view',
                description: 'Pressing this button will take you to the centre of the Lake District, and clear all inputs.'
            }
            },
            {
            element: '#search-row',
            popover: {
                title: 'Find an area',
                description: 'Here you can enter locations which move the map to those locations.'
            }
            },
            {
            element: '#coordinates-area',
            popover: {
                title: 'Route endpoints',
                description: 'Enter start and end coordinates to generate a route, or use the Set buttons and click the map.'
            }
            },
            {
            element: '#generate-path-button',
            popover: {
                title: 'Create the route',
                description: 'Press this button to create a route. You can then click the map to add more waypoints.'
            }
            }
        ]
    });
}

/**
 * Creates and returns the tour for saving a route 
 */
export function createSavingRoutesTour(onTourEnd?: () => void | Promise<void>): Driver {
    return driver({
        popoverClass: 'app-tour-theme',
        showProgress: true,
        onDestroyed: () => {
            if (typeof onTourEnd === 'function') onTourEnd();
        },
        steps: [
            {
            element: '#save-route-button-container',
            popover: {
                title: 'Saving Your Route',
                description: 'Click here to open a panel to save this route.'
            }
            },
            {
            element: '#route-stats',
            popover: {
                title: 'Route Statistics',
                description: "Here you can view key details of your route such as it's distance, elevation change and time taken to complete."
            }
            },
            {
            element: '#toggle-elevation-chart',
            popover: {
                title: 'Elevation Profile',
                description: 'Pressing this button will open a panel showing you an elevation profile of your route.'
            }
            }
        ]
    });
}

/**
 * Creates and returns the tour for the settings panel
 */
export function createSettingsTour(): Driver {
    return driver({
        popoverClass: 'app-tour-theme',
        showProgress: true,
        steps: [
            {
                popover: {
                    title: 'App Preferences',
                    description: 'Adjust your distance units and app appearance here. We’re in Beta, so drop us a line via feedback if there are other options you want to see!'
                }
            },
            {
                element: '#delete-account-container',
                popover: {
                    title: 'Account Control',
                    description: 'If you ever need to close your account, you can manage that right here.'
                }
            },
            {
                element: '#settings-logout-button',
                popover: {
                    title: 'Log Out',
                    description: 'Securely sign out of your session whenever you’re done.'
                }
            }
        ]
    });
}
