import type { Plugin, ViteDevServer } from "vite";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ quiet: true });
const envCache: Record<string, string> = process.env as Record<string, string>;

export function attachSteamRoutes(app: any) {
  app.use("/api/steam/owned-games", async (req: any, res: any) => {
    try {
      const steamId = new URLSearchParams(req.originalUrl?.split("?")[1] ?? "")
        .get("steamId")
        ?.trim();

      if (!steamId || !/^\d{17}$/.test(steamId)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "A 17-digit SteamID64 is required" }));
        return;
      }

      const apiKey = envCache.STEAM_WEB_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "STEAM_WEB_API_KEY is not configured on the server." }));
        return;
      }

      const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { response?: { games?: unknown[] } };

      if (!data.response || !data.response.games) {
        // Profile might be private or empty
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ games: [] }));
        return;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ games: data.response.games }));
    } catch (err: any) {
      console.error("[Steam Error]", err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

export function steamBackend(): Plugin {
  return {
    name: "vite-plugin-steam",
    configurePreviewServer(server) {
      attachSteamRoutes(server.middlewares);
    },
    configureServer(server: ViteDevServer) {
      attachSteamRoutes(server.middlewares);
    },
  };
}
