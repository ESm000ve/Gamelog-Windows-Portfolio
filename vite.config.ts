import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { igdbBackend } from "./server/igdb.ts";
import { aiBackend } from "./server/ai.ts";
import { steamBackend } from "./server/steam.ts";

// https://vite.dev/config/
export default defineConfig({
  // Desktop uses an HTTP origin; nested BrowserRouter routes need root-relative assets.
  base: "/",
  // Only explicitly public variables may be exposed to the renderer.
  envPrefix: "VITE_PUBLIC_",
  build: { manifest: true },
  plugins: [
    react(),
    igdbBackend(),
    aiBackend(),
    steamBackend(),
    ...(process.env.GAMELOG_WEB_ONLY === "1"
      ? []
      : [
          electron({
            main: {
              entry: "electron/main.ts",
              // Clean once; the following preload build shares this output folder.
              vite: { build: { emptyOutDir: true } },
            },
            preload: {
              input: "electron/preload.ts",
            },
            renderer: {},
          }),
        ]),
  ],
});
