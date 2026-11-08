# Windows desktop setup

Use Windows and Node.js 24 LTS:

```powershell
npm ci
npm run build
npm run test:desktop
npm run build:desktop
```

The installer is written to `release/`. For an unpacked build, use `npm run build:desktop -- --dir`. A signed public installer requires your own signing configuration. No signing certificate or personal installer is included in the public source. Windows may warn about unsigned publishers.

## Your service credentials

The packaged app reads `.env` from its Electron user-data folder, normally `%APPDATA%/gamelog` on Windows. Create the folder if needed, copy `.env.example` there as `.env`, and supply your own credentials. A customized app name may change the folder.

Fully exit and reopen Gamelog after editing credentials. The per-user file takes precedence over inherited environment values. Process environment variables are also supported. Source `.env` files are excluded from packages; key values never go to the UI.

The development app reads `.env` in the source folder. Browser and desktop profiles have separate libraries and may use separate credentials.

## Transfer and backups

1. Open Settings in the original app and export a backup.
2. Open Settings in the destination app and import it.
3. Choose Merge to add/update matching records while preserving unrelated records. Use Replace only when you intend to replace the current library.

Version 2 backups include full metadata, logs, lists, tags and sessions and restore offline. Older minimal backups can need catalog access. Backups can contain notes; treat them as private files.

## Storage and updates

Production Electron uses `http://127.0.0.1:43821`. IndexedDB belongs to that origin and profile. Changing `GAMELOG_PORT` changes the storage origin; export first. A busy port produces a startup error instead of silently opening another library.

Application data is preserved on uninstall, but keep exported backups. Updates are manual; automatic updates and cloud sync are not implemented.

The desktop test uses a temporary profile, mocked providers and a synthetic key. It checks the real preload bridge, themes, library persistence and a full process restart without reading the normal app profile.
