import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, Tray } from "electron";
import Store from "electron-store";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "../shared/constants.js";
import type { AppSettings, HolidayItem } from "../shared/types.js";
import { mergeSettings } from "../shared/time.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

const store = new Store<{
  settings: AppSettings;
  holidays: Record<string, { fetchedAt: string; items: HolidayItem[] }>;
}>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    holidays: {}
  }
});

let settingsWindow: BrowserWindow | undefined;
let petWindow: BrowserWindow | undefined;
let tray: Tray | undefined;

function rendererPath(route: string) {
  return isDev ? `${rendererUrl}/#${route}` : `file://${path.join(__dirname, "../renderer/index.html")}#${route}`;
}

function getSettings(): AppSettings {
  return mergeSettings(store.get("settings"));
}

function saveSettings(settings: AppSettings): AppSettings {
  const merged = mergeSettings(settings);
  store.set("settings", merged);
  applyAutoStart(merged.autoStart);
  petWindow?.setOpacity(merged.pet.opacity / 100);
  if (petWindow && merged.pet.position) {
    petWindow.setPosition(merged.pet.position.x, merged.pet.position.y);
  }
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send("settings:changed", merged));
  updateTrayMenu();
  return merged;
}

function applyAutoStart(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 920,
    minHeight: 620,
    title: "打工人生存助手",
    backgroundColor: "#fff8ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.loadURL(rendererPath("/settings"));
  settingsWindow.on("closed", () => {
    settingsWindow = undefined;
  });
}

function createPetWindow() {
  const settings = getSettings();
  petWindow = new BrowserWindow({
    width: 340,
    height: 260,
    x: settings.pet.position.x,
    y: settings.pet.position.y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: settings.pet.visible,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  petWindow.setOpacity(settings.pet.opacity / 100);
  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.loadURL(rendererPath("/pet"));
  petWindow.on("moved", () => {
    const [x, y] = petWindow?.getPosition() ?? [settings.pet.position.x, settings.pet.position.y];
    const next = getSettings();
    store.set("settings", { ...next, pet: { ...next.pet, position: { x, y } } });
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const settings = getSettings();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: settings.pet.visible ? "隐藏宠物" : "显示宠物",
        click: () => {
          const next = getSettings();
          next.pet.visible = !next.pet.visible;
          saveSettings(next);
          next.pet.visible ? petWindow?.show() : petWindow?.hide();
        }
      },
      { label: "打开设置", click: createSettingsWindow },
      { label: "关于", click: () => new Notification({ title: "打工人生存助手", body: `版本 ${app.getVersion()}` }).show() },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="9" fill="#ffb45b"/><circle cx="16" cy="17" r="9" fill="#fff1d1"/><circle cx="12" cy="15" r="2" fill="#4e342e"/><circle cx="20" cy="15" r="2" fill="#4e342e"/><path d="M12 21c2 2 6 2 8 0" stroke="#4e342e" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
      )
  );
  tray = new Tray(icon);
  tray.setToolTip("打工人生存助手");
  tray.on("double-click", createSettingsWindow);
  updateTrayMenu();
}

function mapHolidayApi(data: unknown): HolidayItem[] {
  const holiday = (data as { holiday?: Record<string, { holiday?: boolean; name?: string }> }).holiday ?? {};
  return Object.entries(holiday).map(([date, item]) => ({
    date,
    name: item.name ?? "节假日",
    isOffDay: Boolean(item.holiday)
  }));
}

async function getHolidays(year: number): Promise<{ source: "network" | "cache" | "fallback"; holidays: HolidayItem[] }> {
  const cached = store.get(`holidays.${year}`);
  const fresh = cached && new Date(cached.fetchedAt).getFullYear() === new Date().getFullYear();
  if (fresh) return { source: "cache", holidays: cached.items };

  try {
    const response = await fetch(`https://timor.tech/api/holiday/year/${year}`);
    if (!response.ok) throw new Error(`holiday api ${response.status}`);
    const items = mapHolidayApi(await response.json());
    store.set(`holidays.${year}`, { fetchedAt: new Date().toISOString(), items });
    return { source: "network", holidays: items };
  } catch {
    if (cached?.items?.length) return { source: "cache", holidays: cached.items };
    return {
      source: "fallback",
      holidays: [
        { date: `${year}-01-01`, name: "元旦", isOffDay: true },
        { date: `${year}-05-01`, name: "劳动节", isOffDay: true },
        { date: `${year}-10-01`, name: "国庆节", isOffDay: true }
      ]
    };
  }
}

function registerIpc() {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:save", (_event, settings: AppSettings) => saveSettings(settings));
  ipcMain.handle("holidays:get", (_event, year: number) => getHolidays(year));
  ipcMain.handle("window:open-settings", () => createSettingsWindow());
  ipcMain.handle("pet:hide", () => {
    const next = getSettings();
    next.pet.visible = false;
    saveSettings(next);
    petWindow?.hide();
  });
  ipcMain.handle("app:quit", () => app.quit());
}

app.whenReady().then(() => {
  registerIpc();
  applyAutoStart(getSettings().autoStart);
  createTray();
  createPetWindow();
  createSettingsWindow();
});

app.on("window-all-closed", () => {});
