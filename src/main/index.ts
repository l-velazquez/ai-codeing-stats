import { join } from "node:path";
import { homedir } from "node:os";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import icon from "../../resources/icon.png?asset";
import type { RangeKey } from "../shared/types";
import { fetchGithubMonth } from "./github";
import { installClaudeStatusLine } from "./claudeStatusLine";
import { invalidateStatsCache, refreshSubscriptions, scanStats } from "./scanner";
import { checkSystem } from "./systemChecks";

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 660,
    show: false,
    title: "Tokenary",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#0b0c0e",
    icon,
    webPreferences: {
      // Keep the sandboxed preload in CommonJS. Electron's sandboxed preload
      // loader does not reliably execute the ESM bundle emitted by default for
      // this package, and a missing bridge leaves the renderer without IPC.
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => window.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
