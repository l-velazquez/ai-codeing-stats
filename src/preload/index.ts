import { contextBridge, ipcRenderer } from "electron";
import type { ResolvedTheme, Settings, ThemePreference } from "../shared/types";
import type { GitHubMonthSnapshot, RangeKey, StatsSnapshot, SubscriptionUsage, SystemCheckSnapshot, TokenaryBridge } from "../shared/types";

function argValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match === undefined ? null : match.slice(prefix.length);
}

function initialTheme(): { theme: ThemePreference; resolved: ResolvedTheme } {
  const theme = argValue("tokenary-theme");
  const resolved = argValue("tokenary-resolved");
  return {
    theme: theme === "dark" || theme === "light" || theme === "system" ? theme : "system",
    resolved: resolved === "light" ? "light" : "dark",
  };
}

const bridge: TokenaryBridge = {
  scan: (range: RangeKey) => ipcRenderer.invoke("tokenary:scan", range) as Promise<StatsSnapshot>,
  subscriptions: () => ipcRenderer.invoke("tokenary:subscriptions") as Promise<SubscriptionUsage[]>,
  setupClaudeStatusLine: () =>
    ipcRenderer.invoke("tokenary:setup-claude-statusline") as Promise<SubscriptionUsage>,
  systemChecks: () => ipcRenderer.invoke("tokenary:system-checks") as Promise<SystemCheckSnapshot>,
  github: (month: string, refresh?: boolean) =>
    ipcRenderer.invoke("tokenary:github", month, refresh) as Promise<GitHubMonthSnapshot>,
  openPath: (path: string) => ipcRenderer.invoke("tokenary:open-path", path) as Promise<void>,
  openUrl: (url: string) => ipcRenderer.invoke("tokenary:open-url", url) as Promise<void>,
  settings: {
    get: () => ipcRenderer.invoke("tokenary:settings-get") as Promise<Settings>,
    set: (patch: Partial<Settings>) =>
      ipcRenderer.invoke("tokenary:settings-set", patch) as Promise<Settings>,
  },
  initial: initialTheme(),
  platform: process.platform,
};

contextBridge.exposeInMainWorld("tokenary", bridge);
