import type { GitHubMonthSnapshot, RangeKey, StatsSnapshot, Settings, SystemCheckSnapshot } from "@shared/types";
import { demoSnapshot } from "@renderer/demo";
import { demoGithub } from "@renderer/githubDemo";
import { demoState } from "@renderer/lib/demoState";
import { readDemoSettings, writeDemoSettings } from "@renderer/lib/demoSettings";

/**
 * Single place that knows whether we are inside Electron. Previously this test
 * and the matching error were duplicated between App and the Contributions page.
 */
export const IS_ELECTRON = navigator.userAgent.includes("Electron");

export function missingBridgeError(): Error {
  return new Error(
    "Tokenary could not start its local data bridge. Quit and reopen the app; if this continues, reinstall the latest build.",
  );
}

function requireBridge(): void {
  if (!window.tokenary && IS_ELECTRON) throw missingBridgeError();
}

export async function scan(range: RangeKey): Promise<StatsSnapshot> {
  requireBridge();
  if (window.tokenary) return window.tokenary.scan(range);
  if (demoState() === "error") {
    throw new Error(
      "Tokenary could not read local usage metadata. Check that the coding agents on this Mac have written transcripts.",
    );
  }
  return demoSnapshot(range);
}

export async function fetchGithubMonth(month: string, refresh = false): Promise<GitHubMonthSnapshot> {
  requireBridge();
  if (window.tokenary) return window.tokenary.github(month, refresh);
  if (demoState() === "error") {
    throw new Error("GitHub activity could not be loaded.");
  }
  return demoGithub(month);
}

export async function fetchSystemChecks(): Promise<SystemCheckSnapshot> {
  if (window.tokenary) return window.tokenary.systemChecks();
  return {
    checkedAt: Date.now(),
    checks: [
      { id: "github", label: "GitHub access", command: "gh", state: "ready", version: "GitHub CLI", detail: "Ready for Contributions through GitHub CLI.", helpUrl: "https://cli.github.com/" },
      { id: "git", label: "Git", command: "git", state: "ready", version: "git version 2.50.1", detail: "Installed and available to Tokenary.", helpUrl: "https://git-scm.com/download/mac" },
      { id: "codex", label: "Codex", command: "codex", state: "ready", version: "codex-cli", detail: "Installed and available to Tokenary.", helpUrl: "https://learn.chatgpt.com/docs/codex/cli" },
      { id: "claude", label: "Claude Code", command: "claude", state: "missing", version: null, detail: "Install and use Claude Code to create local project metadata for Tokenary.", helpUrl: "https://docs.anthropic.com/en/docs/claude-code/getting-started" },
      { id: "opencode", label: "OpenCode", command: "opencode", state: "ready", version: "opencode", detail: "Installed and available to Tokenary.", helpUrl: "https://opencode.ai/docs/" },
    ],
  };
}

export function readSettings(): Promise<Settings> {
  return window.tokenary ? window.tokenary.settings.get() : Promise.resolve(readDemoSettings());
}

export function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  return window.tokenary
    ? window.tokenary.settings.set(patch)
    : Promise.resolve(writeDemoSettings(patch));
}

export function openPath(path: string): void {
  void window.tokenary?.openPath(path);
}

export function openUrl(url: string): void {
  void window.tokenary?.openUrl(url);
}
