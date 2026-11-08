import { loadDesktopConfig } from "./runtimeConfig.ts";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServerApp } from "../server/app.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let win: BrowserWindow | null = null;

let serverPort: Promise<number> | undefined;
function startExpressServer(): Promise<number> {
  // IndexedDB is scoped to the origin, including the port. Keep it stable across launches.
  return (serverPort ??= new Promise((resolve, reject) => {
    const serverApp = createServerApp(path.join(__dirname, "../dist"));
    const port = Number(process.env.GAMELOG_PORT || 43821);
    const listener = serverApp.listen(port, "127.0.0.1", () => resolve(port));
    listener.on("error", reject);
  }));
}

async function createWindow() {
  loadDesktopConfig(app.getPath("userData"));
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Gamelog",
    minWidth: 640,
    minHeight: 520,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3",
      symbolColor: nativeTheme.shouldUseDarkColors ? "#ffffff" : "#1a1a1a",
      height: 48,
    },
    backgroundMaterial: "mica",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"), // vite-plugin-electron produces .mjs by default
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  if (VITE_DEV_SERVER_URL) {
    // Development mode
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Production mode
    const port = await startExpressServer();
    win.loadURL(`http://127.0.0.1:${port}`);
  }
}

ipcMain.on("gamelog:theme", (event, mode: unknown) => {
  if (
    event.sender !== win?.webContents ||
    (mode !== "system" && mode !== "light" && mode !== "dark")
  )
    return;
  nativeTheme.themeSource = mode;
});
nativeTheme.on("updated", () => {
  if (process.platform !== "win32" || !win || win.isDestroyed()) return;
  win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3");
  win.setTitleBarOverlay({
    color: nativeTheme.shouldUseDarkColors ? "#202020" : "#f3f3f3",
    symbolColor: nativeTheme.shouldUseDarkColors ? "#ffffff" : "#1a1a1a",
    height: 48,
  });
});

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else
  app
    .whenReady()
    .then(createWindow)
    .catch((error: Error) => {
      dialog.showErrorBox("Gamelog could not start", error.message);
      app.quit();
    });
app.on("second-instance", () => {
  win?.show();
  win?.focus();
});

app.on("window-all-closed", () => {
  app.quit();
});
