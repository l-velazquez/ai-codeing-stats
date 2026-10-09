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
    "azul-code could not start its local data bridge. Quit and reopen the app; if this continues, reinstall the latest build.",
  );
}

function requireBridge(): void {
  if (!window.azulCode && IS_ELECTRON) throw missingBridgeError();
}

export async function scan(range: RangeKey, refresh = false): Promise<StatsSnapshot> {
  requireBridge();
  if (window.azulCode) return window.azulCode.scan(range, refresh);
  if (demoState() === "error") {
    throw new Error(
      "azul-code could not read local usage metadata. Check that the coding agents on this Mac have written transcripts.",
    );
  }
  return demoSnapshot(range);
}

export async function fetchGithubMonth(month: string, refresh = false): Promise<GitHubMonthSnapshot> {
  requireBridge();
  if (window.azulCode) return window.azulCode.github(month, refresh);
  if (demoState() === "error") {
    throw new Error("GitHub activity could not be loaded.");
  }
  return demoGithub(month);
}

/** Demo workspaces: one matched by its remote, the rest left to folder names. */
const DEMO_REMOTES: Record<string, string> = {
  "/Users/example/Projects/azul-code": "azul-code",
  "/Users/example/Projects/typeset": "typeset/engine",
};

export async function fetchGithubRemotes(paths: string[]): Promise<Record<string, string | null>> {
  requireBridge();
  if (window.azulCode) return window.azulCode.githubRemotes(paths);
  return Object.fromEntries(paths.map((path) => [path, DEMO_REMOTES[path] ?? null]));
}

export async function fetchSystemChecks(): Promise<SystemCheckSnapshot> {
  if (window.azulCode) return window.azulCode.systemChecks();
  return {
    checkedAt: Date.now(),
    checks: [
      { id: "github", label: "GitHub access", command: "gh", state: "ready", version: "GitHub CLI", detail: "Ready for Contributions through GitHub CLI.", helpUrl: "https://cli.github.com/" },
      { id: "git", label: "Git", command: "git", state: "ready", version: "git version 2.50.1", detail: "Installed and available to azul-code.", helpUrl: "https://git-scm.com/download/mac" },
      { id: "codex", label: "Codex", command: "codex", state: "ready", version: "codex-cli", detail: "Installed and available to azul-code.", helpUrl: "https://learn.chatgpt.com/docs/codex/cli" },
      { id: "claude", label: "Claude Code", command: "claude", state: "missing", version: null, detail: "Install and use Claude Code to create local project metadata for azul-code.", helpUrl: "https://docs.anthropic.com/en/docs/claude-code/getting-started" },
      { id: "opencode", label: "OpenCode", command: "opencode", state: "ready", version: "opencode", detail: "Installed and available to azul-code.", helpUrl: "https://opencode.ai/docs/" },
    ],
  };
}

export function readSettings(): Promise<Settings> {
  return window.azulCode ? window.azulCode.settings.get() : Promise.resolve(readDemoSettings());
}

export function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  return window.azulCode
    ? window.azulCode.settings.set(patch)
    : Promise.resolve(writeDemoSettings(patch));
}

export function openPath(path: string): void {
  void window.azulCode?.openPath(path);
}

export function openUrl(url: string): void {
  void window.azulCode?.openUrl(url);
}
