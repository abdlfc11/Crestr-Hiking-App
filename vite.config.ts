import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const source = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  base: "/static/dist/",

  build: {
    outDir: "static/dist",
    emptyOutDir: true,
    manifest: true,

    rolldownOptions: {
      input: {
        map: source("./static/js/map.ts"),
        savedRoutes: source("./static/js/routes/savedRoutesDashboard.ts"),
        importRoute: source("./static/js/importRoute.ts"),
        auth: source("./static/js/auth/auth.ts"),
        privacyPolicy: source("./static/js/privacy-policy.ts"),
      },
      output: {
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
