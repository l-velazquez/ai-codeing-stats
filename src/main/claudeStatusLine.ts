import { chmod, mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SubscriptionUsage, SubscriptionWindow } from "../shared/types";

const TOKENARY_DIRECTORY = "tokenary";
const CAPTURE_FILE = "rate-limits.json";
const PREVIOUS_COMMAND_FILE = "previous-statusline-command";
const WRAPPER_FILE = "tokenary-statusline.sh";

interface ClaudeRateLimitWindow {
  used_percentage?: unknown;
  resets_at?: unknown;
}

interface ClaudeSettings {
  statusLine?: {
    type?: unknown;
    command?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function paths(claudeHome: string) {
  const tokenaryDirectory = join(claudeHome, TOKENARY_DIRECTORY);
  return {
    capture: join(tokenaryDirectory, CAPTURE_FILE),
    previousCommand: join(tokenaryDirectory, PREVIOUS_COMMAND_FILE),
    settings: join(claudeHome, "settings.json"),
    tokenaryDirectory,
    wrapper: join(tokenaryDirectory, WRAPPER_FILE),
  };
}

async function readSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    const contents = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Claude Code settings must contain a JSON object.");
    }
    return parsed as ClaudeSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    if (error instanceof SyntaxError) {
      throw new Error("Claude Code settings.json is not valid JSON. Fix it before connecting Tokenary.");
    }
    throw error;
  }
}

async function settingsWritePath(settingsPath: string): Promise<string> {
  try {
    return await realpath(settingsPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return settingsPath;
    throw error;
  }
}

async function isConfigured(claudeHome: string): Promise<boolean> {
  try {
    const settings = await readSettings(paths(claudeHome).settings);
    return settings.statusLine?.command === shellQuote(paths(claudeHome).wrapper);
  } catch {
    return false;
  }
}

function claudeWindow(
  label: string,
  windowMinutes: number,
  value: ClaudeRateLimitWindow | null | undefined,
  now: number,
): SubscriptionWindow | null {
  if (value === null || value === undefined) return null;
  const usedPercent = Number(value.used_percentage);
  const resetsAt = Number(value.resets_at) * 1_000;
  if (![usedPercent, resetsAt].every(Number.isFinite) || resetsAt <= now) return null;
  return {
    label,
    usedPercent: Math.min(100, Math.max(0, usedPercent)),
    windowMinutes,
    resetsAt,
  };
}

export function parseClaudeStatusLineSubscription(
  contents: string,
  updatedAt: number,
  configured: boolean,
  now = Date.now(),
): SubscriptionUsage {
  try {
    const parsed = JSON.parse(contents) as {
      rate_limits?: {
        five_hour?: ClaudeRateLimitWindow | null;
        seven_day?: ClaudeRateLimitWindow | null;
      };
      five_hour?: ClaudeRateLimitWindow | null;
      seven_day?: ClaudeRateLimitWindow | null;
    };
    const limits = parsed.rate_limits ?? parsed;
    const windows = [
      claudeWindow("5-hour limit", 300, limits.five_hour, now),
      claudeWindow("Weekly limit", 10_080, limits.seven_day, now),
    ].filter((window): window is SubscriptionWindow => window !== null);
    if (windows.length > 0) {
      return {
        provider: "claude",
        state: "live",
        plan: null,
        updatedAt,
        windows,
        detail: "Captured locally through Claude Code’s official status line.",
        capture: { kind: "claude-statusline", state: "active" },
      };
    }
    return {
      provider: "claude",
      state: "unavailable",
      plan: null,
      updatedAt,
      windows: [],
      detail: "The last captured allowance has expired. Send a Claude Code message to refresh it.",
      capture: { kind: "claude-statusline", state: configured ? "waiting" : "not-configured" },
    };
  } catch {
    return unavailableUsage(configured, "The captured Claude allowance could not be read. Send a Claude Code message to replace it.");
  }
}

function unavailableUsage(configured: boolean, detail?: string): SubscriptionUsage {
  return {
    provider: "claude",
    state: "unavailable",
    plan: null,
    updatedAt: null,
    windows: [],
    detail: detail ?? (configured
      ? "Connected. Start or resume Claude Code, accept its trust prompt if shown, and send a message to capture the limits."
      : "Connect Tokenary to Claude Code’s status line to capture provider-reported limits locally."),
    capture: { kind: "claude-statusline", state: configured ? "waiting" : "not-configured" },
  };
}

export async function readClaudeStatusLineSubscription(claudeHome: string): Promise<SubscriptionUsage> {
  const configured = await isConfigured(claudeHome);
  const capturePath = paths(claudeHome).capture;
  try {
    const [contents, metadata] = await Promise.all([readFile(capturePath, "utf8"), stat(capturePath)]);
    return parseClaudeStatusLineSubscription(contents, metadata.mtimeMs, configured);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return unavailableUsage(configured);
    return unavailableUsage(configured, "Tokenary could not read the local Claude allowance capture.");
  }
}

function wrapperContents(): string {
  return `#!/bin/sh
set -u
umask 077

tokenary_dir="$HOME/.claude/tokenary"
incoming="$tokenary_dir/statusline-input.$$"
candidate="$tokenary_dir/rate-limits.json.$$"
capture="$tokenary_dir/rate-limits.json"
previous="$tokenary_dir/previous-statusline-command"

mkdir -p "$tokenary_dir" || exit 0
trap 'rm -f "$incoming" "$candidate"' EXIT HUP INT TERM
cat > "$incoming" || exit 0

# plutil is built into macOS. Extract only rate_limits so Tokenary never stores
# session identifiers, workspace paths, transcript paths, or other status data.
if /usr/bin/plutil -extract rate_limits json -o "$candidate" "$incoming" >/dev/null 2>&1; then
  chmod 600 "$candidate"
  mv -f "$candidate" "$capture"
fi

if [ -s "$previous" ]; then
  previous_command=$(cat "$previous")
  /bin/sh -c "$previous_command" < "$incoming"
else
  printf 'Tokenary · Claude allowance connected\\n'
fi
`;
}

export async function installClaudeStatusLine(claudeHome: string): Promise<SubscriptionUsage> {
  const target = paths(claudeHome);
  const settings = await readSettings(target.settings);
  const configuredCommand = settings.statusLine?.command;
  const tokenaryCommand = shellQuote(target.wrapper);

  await mkdir(target.tokenaryDirectory, { recursive: true, mode: 0o700 });
  if (typeof configuredCommand === "string" && configuredCommand !== tokenaryCommand) {
    await writeFile(target.previousCommand, configuredCommand, { encoding: "utf8", mode: 0o600 });
    await chmod(target.previousCommand, 0o600);
  }
  await writeFile(target.wrapper, wrapperContents(), { encoding: "utf8", mode: 0o700 });
  await chmod(target.wrapper, 0o700);

  const nextSettings: ClaudeSettings = {
    ...settings,
    statusLine: {
      ...settings.statusLine,
      type: "command",
      command: tokenaryCommand,
    },
  };
  const writeTarget = await settingsWritePath(target.settings);
  const temporarySettings = `${writeTarget}.tokenary-${process.pid}`;
  await writeFile(temporarySettings, `${JSON.stringify(nextSettings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporarySettings, writeTarget);
  await chmod(writeTarget, 0o600);
  return readClaudeStatusLineSubscription(claudeHome);
}
