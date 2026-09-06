import { join } from "node:path";
import { homedir } from "node:os";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import icon from "../../resources/icon.png?asset";
import type { RangeKey } from "../shared/types";
import { resolveTheme, THEME_BACKGROUND, type Settings } from "../shared/settings";
import { fetchGithubMonth } from "./github";
import { installClaudeStatusLine } from "./claudeStatusLine";
import { invalidateStatsCache, refreshSubscriptions, scanStats } from "./scanner";
import { checkSystem } from "./systemChecks";
import { readSettings, usableBounds, writeSettings } from "./settingsStore";

let mainWindow: BrowserWindow | null = null;
let saveBoundsTimer: NodeJS.Timeout | null = null;

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

function createWindow(): void {
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
    title: "Tokenary",
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
        `--tokenary-theme=${settings.theme}`,
        `--tokenary-resolved=${resolved}`,
        `--tokenary-sidebar=${settings.sidebarCollapsed ? "collapsed" : "expanded"}`,
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
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Without this, an unpackaged run resolves app.getName() to "Electron" and
// stores preferences under Application Support/Electron, so a development run
// and the packaged app would keep separate settings and window bounds.
app.setName("Tokenary");

app.whenReady().then(() => {
  const settings = readSettings();
  // Set before the first window so traffic lights, context menus and native
  // scrollbars match the chosen theme too, not just the page.
  nativeTheme.themeSource = settings.theme;

  nativeTheme.on("updated", () => {
    const current = readSettings();
    if (current.theme !== "system" || mainWindow === null || mainWindow.isDestroyed()) return;
    mainWindow.setBackgroundColor(THEME_BACKGROUND[currentResolvedTheme(current)]);
  });

  ipcMain.handle("tokenary:scan", (_event, range: RangeKey) => scanStats(range));
  ipcMain.handle("tokenary:subscriptions", () => refreshSubscriptions());
  ipcMain.handle("tokenary:setup-claude-statusline", async () => {
    const usage = await installClaudeStatusLine(join(homedir(), ".claude"));
    invalidateStatsCache();
    return usage;
  });
  ipcMain.handle("tokenary:system-checks", () => checkSystem());
  ipcMain.handle("tokenary:github", (_event, month: string, refresh?: boolean) => {
    if (typeof month !== "string") throw new Error("A YYYY-MM month is required.");
    return fetchGithubMonth(month, Boolean(refresh));
  });
  ipcMain.handle("tokenary:open-path", async (_event, path: string) => {
    if (path) await shell.openPath(path);
  });
  ipcMain.handle("tokenary:open-url", (_event, url: string) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
  });
  ipcMain.handle("tokenary:settings-get", () => readSettings());
  ipcMain.handle("tokenary:settings-set", (_event, patch: Partial<Settings>) => {
    const next = writeSettings(patch ?? {});
    if (patch && "theme" in patch) {
      nativeTheme.themeSource = next.theme;
      if (mainWindow !== null && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor(THEME_BACKGROUND[currentResolvedTheme(next)]);
      }
    }
    return next;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
