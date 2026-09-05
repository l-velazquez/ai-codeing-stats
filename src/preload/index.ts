import { contextBridge, ipcRenderer } from "electron";
import type { GitHubMonthSnapshot, RangeKey, StatsSnapshot, SubscriptionUsage, SystemCheckSnapshot, TokenaryBridge } from "../shared/types";

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
  platform: process.platform,
};

contextBridge.exposeInMainWorld("tokenary", bridge);
