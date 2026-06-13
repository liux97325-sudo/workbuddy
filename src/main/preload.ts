import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, WorkBuddyApi } from "../shared/types.js";

const api: WorkBuddyApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("settings:save", settings),
  getHolidays: (year: number) => ipcRenderer.invoke("holidays:get", year),
  openSettings: () => ipcRenderer.invoke("window:open-settings"),
  hidePet: () => ipcRenderer.invoke("pet:hide"),
  quit: () => ipcRenderer.invoke("app:quit"),
  onSettingsChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  }
};

contextBridge.exposeInMainWorld("workBuddy", api);
