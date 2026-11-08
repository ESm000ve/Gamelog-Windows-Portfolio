import { contextBridge, ipcRenderer } from "electron";
// Read-only platform information; no arbitrary IPC is exposed to the renderer.
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isElectron: true,
  setTheme: (mode: string) => ipcRenderer.send("gamelog:theme", mode),
});
