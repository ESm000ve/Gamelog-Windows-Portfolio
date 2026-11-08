# Architecture

The browser and Windows app share React screens, local data services and API handlers.

```text
React UI → repositories → Dexie / IndexedDB (personal records)
        → local /api handlers → IGDB / Twitch, Gemini, Steam
        → CheapShark (optional deal lookup)

Electron → loopback Express server → production React assets
Vite     → development middleware → the same API handlers
```

`src/screens` owns page composition. `src/components/ui` and `src/components/features` contain shared controls and workflows. `src/services` provides validation, recommendations, statistics and interaction coordination. Repositories under `src/db` own transactional persistence; schema migrations are append-only.

The renderer receives no service credentials. `server/` reads private environment variables and makes provider requests. Vite exposes only explicitly public `VITE_PUBLIC_` values. Electron loads per-user configuration after its profile is initialized. Package inclusion rules admit compiled assets and app metadata, excluding source environment files.

Production uses a stable loopback origin so the IndexedDB library survives launches. Screens and dialogs load on demand, with dismissible failure states when a deferred chunk fails. Theme changes synchronize semantic CSS tokens with the Windows shell.

This server is intended for a local app. Public hosting would require authentication, per-user credential isolation, rate limits and a deployment design. The source does not implement a hosted multi-user service.
