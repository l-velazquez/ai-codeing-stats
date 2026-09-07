import { contextBridge, ipcRenderer } from "electron";
import type { MenuBarState } from "../shared/menuBar";
import type { ResolvedTheme, Settings, ThemePreference } from "../shared/types";
import type { GitHubMonthSnapshot, RangeKey, StatsSnapshot, SubscriptionUsage, SystemCheckSnapshot, TallyBridge } from "../shared/types";

function argValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match === undefined ? null : match.slice(prefix.length);
}

function initialState(): TallyBridge["initial"] {
  const theme = argValue("tally-theme");
  const resolved = argValue("tally-resolved");
  return {
    accent: (["red", "orange", "green", "blue", "pink", "violet"].includes(argValue("tally-accent") ?? "") ? argValue("tally-accent") : "blue") as NonNullable<TallyBridge["initial"]["accent"]>,
    theme: theme === "dark" || theme === "light" || theme === "system" ? theme : "system",
    resolved: resolved === "light" ? "light" : "dark",
    sidebarCollapsed: argValue("tally-sidebar") === "collapsed",
  };
}

const bridge: TallyBridge = {
  resources: () => ipcRenderer.invoke("tally:resources"),
  scan: (range: RangeKey, refresh?: boolean) => ipcRenderer.invoke("tally:scan", range, refresh) as Promise<StatsSnapshot>,
  onStatsChanged: (listener) => subscribe("tally:stats-changed", listener),
  onSettingsChanged: (listener) => subscribe("tally:settings-changed", listener),
  onOpenSettings: (listener) => subscribe("tally:open-settings", listener),
  menuBar: {
    get: () => ipcRenderer.invoke("tally:menubar-get") as Promise<MenuBarState>,
    refresh: () => ipcRenderer.invoke("tally:menubar-refresh") as Promise<MenuBarState>,
    onChange: (listener) => subscribe("tally:menubar-changed", listener),
    openDashboard: (settings?: boolean) => ipcRenderer.invoke("tally:open-dashboard", settings) as Promise<void>,
    hide: () => ipcRenderer.invoke("tally:menubar-hide") as Promise<void>,
    quit: () => ipcRenderer.invoke("tally:quit") as Promise<void>,
  },
  subscriptions: () => ipcRenderer.invoke("tally:subscriptions") as Promise<SubscriptionUsage[]>,
  setupClaudeStatusLine: () =>
    ipcRenderer.invoke("tally:setup-claude-statusline") as Promise<SubscriptionUsage>,
  systemChecks: () => ipcRenderer.invoke("tally:system-checks") as Promise<SystemCheckSnapshot>,
  github: (month: string, refresh?: boolean) =>
    ipcRenderer.invoke("tally:github", month, refresh) as Promise<GitHubMonthSnapshot>,
  openPath: (path: string) => ipcRenderer.invoke("tally:open-path", path) as Promise<void>,
  openUrl: (url: string) => ipcRenderer.invoke("tally:open-url", url) as Promise<void>,
  settings: {
    get: () => ipcRenderer.invoke("tally:settings-get") as Promise<Settings>,
    set: (patch: Partial<Settings>) =>
      ipcRenderer.invoke("tally:settings-set", patch) as Promise<Settings>,
  },
  initial: initialState(),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("tally", bridge);

/** Never expose Electron's event object or arbitrary IPC channel access. */
function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
}
