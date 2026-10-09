import { collectResources } from "./diagnostics";
import { join } from "node:path";
import { homedir } from "node:os";
import { app, BrowserWindow, ipcMain, nativeTheme, powerMonitor, shell } from "electron";
import icon from "../../resources/icon.png?asset";
import type { RangeKey } from "../shared/types";
import { resolveTheme, themeBackground, type Settings } from "../shared/settings";
import { fetchGithubMonth } from "./github";
import { githubRemotes } from "./gitRemotes";
import { installClaudeStatusLine } from "./claudeStatusLine";
import { cachedStats, markPricingChanged, refreshStats, statsRevision } from "./scanner";
import { LIVE_INTERVAL_MS, StatsService, WATCHED_INTERVAL_MS } from "./statsService";
import { SourceWatcher, transcriptWatchTargets } from "./sourceWatcher";
import { MenuBar } from "./menuBar";
import { checkSystem } from "./systemChecks";
import { readSettings, usableBounds, writeSettings } from "./settingsStore";
import { PricingUpdater } from "./pricingUpdater";

let mainWindow: BrowserWindow | null = null;
let saveBoundsTimer: NodeJS.Timeout | null = null;
let menuBar: MenuBar | null = null;
const stats = new StatsService({
  refresh: refreshStats,
  read: cachedStats,
  revision: statsRevision,
});

// Live prices only take effect once something re-aggregates, so a change is
// treated like new usage on disk.
let pricing: PricingUpdater | null = null;

// Watching the transcript directories is what makes usage feel live; the poll
// behind it only has to cover what a watcher can miss.
const watcher = new SourceWatcher(transcriptWatchTargets(), () => stats.refresh({ silent: true }));

function startScanning(): void {
  const watched = watcher.start();
  stats.setPollInterval(watched > 0 ? WATCHED_INTERVAL_MS : LIVE_INTERVAL_MS);
  stats.start();
}

function stopScanning(): void {
  stats.stop();
  watcher.stop();
}

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
    if (settings) mainWindow.webContents.send("azul-code:open-settings");
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
    // Painted before the renderer's first frame; must match the theme and the
    // accent, or a launch flashes the wrong ground colour.
    backgroundColor: themeBackground(resolved, settings.accent, settings.customAccent),
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
        `--azul-code-theme=${settings.theme}`,
        `--azul-code-accent=${settings.accent}`,
        `--azul-code-custom=${settings.customAccent}`,
        `--azul-code-resolved=${resolved}`,
        `--azul-code-sidebar=${settings.sidebarCollapsed ? "collapsed" : "expanded"}`,
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
if (app.getPath("userData") === join(app.getPath("appData"), app.getName())) {
  app.setPath("userData", join(app.getPath("appData"), "azul-code"));
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
    mainWindow.setBackgroundColor(themeBackground(currentResolvedTheme(current), current.accent, current.customAccent));
  });

  ipcMain.handle("azul-code:scan", (_event, range: RangeKey, refresh?: boolean) => {
    if (!["7d", "30d", "90d", "all"].includes(range)) throw new Error("Invalid usage range.");
    return stats.read(range, refresh === true);
  });
  ipcMain.handle("azul-code:subscriptions", async () => (await stats.read("7d")).subscriptions);
  ipcMain.handle("azul-code:menubar-get", () => stats.getState());
  ipcMain.handle("azul-code:menubar-refresh", () => stats.refresh());
  ipcMain.handle("azul-code:open-dashboard", (_event, settings?: boolean) => openDashboard(settings === true));
  ipcMain.handle("azul-code:menubar-hide", () => menuBar?.hide());
  ipcMain.handle("azul-code:quit", () => app.quit());
  ipcMain.on("azul-code:menubar-height", (_event, height: unknown) => {
    if (typeof height === "number" && Number.isFinite(height) && height >= 0 && height <= 4000) {
      menuBar?.setContentHeight(height);
    }
  });
  ipcMain.handle("azul-code:setup-claude-statusline", async () => {
    const usage = await installClaudeStatusLine(join(homedir(), ".claude"));
    await stats.refresh();
    return usage;
  });
  ipcMain.handle("azul-code:resources", () => collectResources());
  ipcMain.handle("azul-code:system-checks", () => checkSystem());
  ipcMain.handle("azul-code:github", (_event, month: string, refresh?: boolean) => {
    if (typeof month !== "string") throw new Error("A YYYY-MM month is required.");
    return fetchGithubMonth(month, Boolean(refresh));
  });
  ipcMain.handle("azul-code:github-remotes", (_event, paths: unknown) => githubRemotes(paths));
  ipcMain.handle("azul-code:open-path", async (_event, path: string) => {
    if (path) await shell.openPath(path);
  });
  ipcMain.handle("azul-code:open-url", (_event, url: string) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
  });
  ipcMain.handle("azul-code:pricing-status", () => pricing?.status());
  ipcMain.handle("azul-code:settings-get", () => readSettings());
  ipcMain.handle("azul-code:settings-set", (_event, patch: Partial<Settings>) => {
    const next = writeSettings(patch ?? {});
    menuBar?.configure(next);
    if (patch && "theme" in patch) nativeTheme.themeSource = next.theme;
    if (patch && "livePricing" in patch) pricing?.setEnabled(next.livePricing);
    // The accent tints the page ground too, so it repaints the window as well.
    if (patch && ("theme" in patch || "accent" in patch || "customAccent" in patch) && mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(themeBackground(currentResolvedTheme(next), next.accent, next.customAccent));
    }
    broadcast("azul-code:settings-changed", next);
    return next;
  });

  pricing = new PricingUpdater({
    path: join(app.getPath("userData"), "pricing.json"),
    onChange: () => {
      markPricingChanged();
      // Before the first scan there is nothing to reprice; that scan uses the new prices.
      if (stats.getState().summary !== null) void stats.refresh({ silent: true });
    },
  });
  pricing.setEnabled(settings.livePricing);

  createWindow();
  menuBar = new MenuBar(stats, settings, openDashboard);
  stats.subscribe((state, updated) => {
    broadcast("azul-code:menubar-changed", state);
    if (updated) broadcast("azul-code:stats-changed");
  });
  startScanning();
  // A directory that only appears after launch is picked up by re-watching here.
  powerMonitor.on("suspend", () => { stopScanning(); menuBar?.hide(); });
  powerMonitor.on("resume", () => startScanning());

  app.on("activate", () => {
    openDashboard();
  });
});

app.on("before-quit", () => { stopScanning(); pricing?.stop(); menuBar?.destroy(); menuBar = null; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
