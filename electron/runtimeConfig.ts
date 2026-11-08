import path from "node:path";
import dotenv from "dotenv";

/** Read private desktop settings after Electron has initialized its profile. */
export function loadDesktopConfig(userData: string) {
  // The per-user file wins over empty or stale launcher/development variables.
  // Never include this file or its values in the distributable application.
  dotenv.config({ path: path.join(userData, ".env"), override: true, quiet: true });
  dotenv.config({ quiet: true });
}
