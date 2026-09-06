import { join } from "node:path";
import { homedir } from "node:os";
import { app, BrowserWindow, ipcMain, nativeTheme, powerMonitor, shell } from "electron";
import icon from "../../resources/icon.png?asset";
import type { RangeKey } from "../shared/types";
import { resolveTheme, THEME_BACKGROUND, type Settings } from "../shared/settings";
import { fetchGithubMonth } from "./github";
import { installClaudeStatusLine } from "./claudeStatusLine";
import { cachedStats, invalidateStatsCache, scanStats } from "./scanner";
import { StatsService } from "./statsService";
import { MenuBar } from "./menuBar";
import { checkSystem } from "./systemChecks";
import { readSettings, usableBounds, writeSettings } from "./settingsStore";

let mainWindow: BrowserWindow | null = null;
let saveBoundsTimer: NodeJS.Timeout | null = null;
let menuBar: MenuBar | null = null;
const stats = new StatsService({
  refresh: () => { invalidateStatsCache(); return scanStats("7d"); },
  read: cachedStats,
});

function broadcast(channel: string, value?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, value);
  }
}

function openDashboard(settings = false): void {
  menuBar?.hide();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(settings);
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (settings) mainWindow.webContents.send("tally:open-settings");
  }
}

function currentResolvedTheme(settings: Settings): "dark" | "light" {
  return resolveTheme(settings.theme, nativeTheme.shouldUseDarkColors);
}

function scheduleBoundsSave(window: BrowserWindow): void {
  if (saveBoundsTimer !== null) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    saveBoundsTimer = null;
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
    const { width, height, x, y } = window.getNormalBounds();
    writeSettings({ window: { width, height, x, y } });
  }, 400);
}

function createWindow(openSettings = false): void {
  const settings = readSettings();
  const bounds = usableBounds(settings.window);
  const resolved = currentResolvedTheme(settings);

  const window = new BrowserWindow({
    width: bounds?.width ?? 1440,
    height: bounds?.height ?? 920,
    ...(bounds?.x === undefined ? {} : { x: bounds.x }),
    ...(bounds?.y === undefined ? {} : { y: bounds.y }),
    minWidth: 980,
    minHeight: 660,
    show: false,
    title: "azul-code",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    // Painted before the renderer's first frame; must match the theme or a
    // light-theme launch flashes dark.
    backgroundColor: THEME_BACKGROUND[resolved],
    icon,
    webPreferences: {
      // Keep the sandboxed preload in CommonJS. Electron's sandboxed preload
      // loader does not reliably execute the ESM bundle emitted by default for
      // this package, and a missing bridge leaves the renderer without IPC.
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Read by the preload before any page script runs, so the pre-paint
      // script in index.html can set the theme on the very first frame.
      additionalArguments: [
        `--tally-theme=${settings.theme}`,
        `--tally-accent=${settings.accent}`,
        `--tally-resolved=${resolved}`,
        `--tally-sidebar=${settings.sidebarCollapsed ? "collapsed" : "expanded"}`,
      ],
    },
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());
  window.on("resized", () => scheduleBoundsSave(window));
  window.on("moved", () => scheduleBoundsSave(window));
  window.on("close", () => {
    if (saveBoundsTimer !== null) {
      clearTimeout(saveBoundsTimer);
      saveBoundsTimer = null;
    }
    if (window.isMinimized() || window.isFullScreen()) return;
    const { width, height, x, y } = window.getNormalBounds();
    writeSettings({ window: { width, height, x, y } });
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (openSettings) url.searchParams.set("settings", "open");
    void window.loadURL(url.toString());
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"), { query: openSettings ? { settings: "open" } : {} });
  }
}

// Without this, an unpackaged run resolves app.getName() to "Electron" and
// stores preferences under Application Support/Electron, so a development run
// and the packaged app would keep separate settings and window bounds.
// Keep the existing preferences directory across the display-name change.
if (app.getPath("userData") === join(app.getPath("appData"), app.getName())) {
  app.setPath("userData", join(app.getPath("appData"), "Tally"));
}
app.setName("azul-code");
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => { if (app.isReady()) openDashboard(); });

app.whenReady().then(() => {
  if (!primaryInstance) return;
  // macOS development runs use Electron's bundle icon unless set explicitly.
  app.dock?.setIcon(icon);
  const settings = readSettings();
  // Set before the first window so traffic lights, context menus and native
  // scrollbars match the chosen theme too, not just the page.
  nativeTheme.themeSource = settings.theme;

  nativeTheme.on("updated", () => {
    const current = readSettings();
    menuBar?.updateTheme();
    if (current.theme !== "system" || mainWindow === null || mainWindow.isDestroyed()) return;
    mainWindow.setBackgroundColor(THEME_BACKGROUND[currentResolvedTheme(current)]);
  });

  ipcMain.handle("tally:scan", (_event, range: RangeKey, refresh?: boolean) => {
    if (!["7d", "30d", "90d", "all"].includes(range)) throw new Error("Invalid usage range.");
    return stats.read(range, refresh === true);
  });
  ipcMain.handle("tally:subscriptions", async () => (await stats.read("7d")).subscriptions);
  ipcMain.handle("tally:menubar-get", () => stats.getState());
  ipcMain.handle("tally:menubar-refresh", () => stats.refresh());
  ipcMain.handle("tally:open-dashboard", (_event, settings?: boolean) => openDashboard(settings === true));
  ipcMain.handle("tally:menubar-hide", () => menuBar?.hide());
  ipcMain.handle("tally:quit", () => app.quit());
  ipcMain.handle("tally:setup-claude-statusline", async () => {
    const usage = await installClaudeStatusLine(join(homedir(), ".claude"));
    await stats.refresh();
    return usage;
  });
  ipcMain.handle("tally:system-checks", () => checkSystem());
  ipcMain.handle("tally:github", (_event, month: string, refresh?: boolean) => {
    if (typeof month !== "string") throw new Error("A YYYY-MM month is required.");
    return fetchGithubMonth(month, Boolean(refresh));
  });
  ipcMain.handle("tally:open-path", async (_event, path: string) => {
    if (path) await shell.openPath(path);
  });
  ipcMain.handle("tally:open-url", (_event, url: string) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
  });
  ipcMain.handle("tally:settings-get", () => readSettings());
  ipcMain.handle("tally:settings-set", (_event, patch: Partial<Settings>) => {
    const next = writeSettings(patch ?? {});
    menuBar?.configure(next);
    if (patch && "theme" in patch) {
      nativeTheme.themeSource = next.theme;
      if (mainWindow !== null && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor(THEME_BACKGROUND[currentResolvedTheme(next)]);
      }
    }
    broadcast("tally:settings-changed", next);
    return next;
  });

  createWindow();
  menuBar = new MenuBar(stats, settings, openDashboard);
  stats.subscribe((state, updated) => {
    broadcast("tally:menubar-changed", state);
    if (updated) broadcast("tally:stats-changed");
  });
  stats.start();
  powerMonitor.on("suspend", () => { stats.stop(); menuBar?.hide(); });
  powerMonitor.on("resume", () => stats.start());

  app.on("activate", () => {
    openDashboard();
  });
});

app.on("before-quit", () => { stats.stop(); menuBar?.destroy(); menuBar = null; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
