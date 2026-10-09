import { contextBridge, ipcRenderer } from "electron";
import { customAccentVars, normalizeHexColor } from "../shared/settings";
import type { MenuBarState } from "../shared/menuBar";
import type { ResolvedTheme, Settings, ThemePreference } from "../shared/types";
import type { GitHubMonthSnapshot, RangeKey, StatsSnapshot, SubscriptionUsage, SystemCheckSnapshot, AzulCodeBridge } from "../shared/types";

function argValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match === undefined ? null : match.slice(prefix.length);
}

function initialState(): AzulCodeBridge["initial"] {
  const theme = argValue("azul-code-theme");
  const resolved = argValue("azul-code-resolved");
  const rawAccent = argValue("azul-code-accent");
  const accent = (["custom", "red", "orange", "green", "blue", "pink", "violet"].includes(rawAccent ?? "") ? rawAccent : "blue") as NonNullable<AzulCodeBridge["initial"]["accent"]>;
  const customAccent = normalizeHexColor(argValue("azul-code-custom"));
  return {
    accent,
    customAccent,
    roles: accent === "custom" ? customAccentVars(customAccent) : null,
    theme: theme === "dark" || theme === "light" || theme === "system" ? theme : "system",
    resolved: resolved === "light" ? "light" : "dark",
    sidebarCollapsed: argValue("azul-code-sidebar") === "collapsed",
  };
}

const bridge: AzulCodeBridge = {
  resources: () => ipcRenderer.invoke("azul-code:resources"),
  scan: (range: RangeKey, refresh?: boolean) => ipcRenderer.invoke("azul-code:scan", range, refresh) as Promise<StatsSnapshot>,
  onStatsChanged: (listener) => subscribe("azul-code:stats-changed", listener),
  onSettingsChanged: (listener) => subscribe("azul-code:settings-changed", listener),
  onOpenSettings: (listener) => subscribe("azul-code:open-settings", listener),
  menuBar: {
    get: () => ipcRenderer.invoke("azul-code:menubar-get") as Promise<MenuBarState>,
    refresh: () => ipcRenderer.invoke("azul-code:menubar-refresh") as Promise<MenuBarState>,
    onChange: (listener) => subscribe("azul-code:menubar-changed", listener),
    openDashboard: (settings?: boolean) => ipcRenderer.invoke("azul-code:open-dashboard", settings) as Promise<void>,
    hide: () => ipcRenderer.invoke("azul-code:menubar-hide") as Promise<void>,
    quit: () => ipcRenderer.invoke("azul-code:quit") as Promise<void>,
    // Fire-and-forget: it reports on every content change and wants no reply, so a
    // promise per report would only risk rejections after the panel is destroyed.
    setHeight: (height: number) => { ipcRenderer.send("azul-code:menubar-height", height); },
  },
  subscriptions: () => ipcRenderer.invoke("azul-code:subscriptions") as Promise<SubscriptionUsage[]>,
  setupClaudeStatusLine: () =>
    ipcRenderer.invoke("azul-code:setup-claude-statusline") as Promise<SubscriptionUsage>,
  systemChecks: () => ipcRenderer.invoke("azul-code:system-checks") as Promise<SystemCheckSnapshot>,
  github: (month: string, refresh?: boolean) =>
    ipcRenderer.invoke("azul-code:github", month, refresh) as Promise<GitHubMonthSnapshot>,
  githubRemotes: (paths: string[]) =>
    ipcRenderer.invoke("azul-code:github-remotes", paths) as Promise<Record<string, string | null>>,
  openPath: (path: string) => ipcRenderer.invoke("azul-code:open-path", path) as Promise<void>,
  openUrl: (url: string) => ipcRenderer.invoke("azul-code:open-url", url) as Promise<void>,
  settings: {
    get: () => ipcRenderer.invoke("azul-code:settings-get") as Promise<Settings>,
    set: (patch: Partial<Settings>) =>
      ipcRenderer.invoke("azul-code:settings-set", patch) as Promise<Settings>,
  },
  initial: initialState(),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("azulCode", bridge);

/** Never expose Electron's event object or arbitrary IPC channel access. */
function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
}
