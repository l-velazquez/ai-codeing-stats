import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { SystemCheck, SystemCheckSnapshot, SystemToolId } from "../shared/types";
import { githubCliCandidates } from "./github";

const execFileAsync = promisify(execFile);

interface ToolDefinition {
  readonly id: SystemToolId;
  readonly label: string;
  readonly commands: string[];
  readonly helpUrl: string;
  readonly missingDetail: string;
}

interface DetectedCommand {
  readonly executable: string;
  readonly version: string | null;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "git",
    label: "Git",
    commands: ["git"],
    helpUrl: "https://git-scm.com/download/mac",
    missingDetail: "Optional for azul-code's API-based contribution ledger, but recommended for local development.",
  },
  {
    id: "codex",
    label: "Codex",
    commands: ["codex"],
    helpUrl: "https://learn.chatgpt.com/docs/codex/cli",
    missingDetail: "Install and use Codex to create local session metadata for azul-code.",
  },
  {
    id: "claude",
    label: "Claude Code",
    commands: ["claude"],
    helpUrl: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
    missingDetail: "Install and use Claude Code to create local project metadata for azul-code.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    commands: ["opencode", "opencode2"],
    helpUrl: "https://opencode.ai/docs/",
    missingDetail: "Install and use OpenCode to create the local database azul-code reads.",
  },
];

function cleanVersion(stdout: string, stderr: string): string | null {
  const firstLine = `${stdout}\n${stderr}`
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 100) : null;
}

async function dynamicNodeBinDirectories(home: string): Promise<string[]> {
  try {
    const versions = await readdir(join(home, ".nvm", "versions", "node"), { withFileTypes: true });
    return versions.filter((entry) => entry.isDirectory()).map((entry) => join(home, ".nvm", "versions", "node", entry.name, "bin"));
  } catch {
    return [];
  }
}

export async function commandCandidates(command: string, pathValue = process.env.PATH, home = homedir()): Promise<string[]> {
  const directories = [
    ...(pathValue?.split(":") ?? []).filter((entry) => entry.startsWith("/")),
    dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    join(home, ".local", "bin"),
    join(home, "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".volta", "bin"),
    join(home, ".bun", "bin"),
    join(home, "Library", "pnpm"),
    ...(await dynamicNodeBinDirectories(home)),
  ];
  return [...new Set([command, ...directories.map((directory) => join(directory, command))])];
}

async function detectCommand(commands: readonly string[], candidates?: readonly string[]): Promise<DetectedCommand | null> {
  const executableCandidates = candidates ?? (await Promise.all(commands.map((command) => commandCandidates(command)))).flat();
  for (const executable of [...new Set(executableCandidates)]) {
    try {
      const { stdout, stderr } = await execFileAsync(executable, ["--version"], { timeout: 4_000 });
      return { executable, version: cleanVersion(stdout, stderr) };
    } catch {
      // Keep looking in paths that GUI-launched macOS apps commonly omit.
    }
  }
  return null;
}

async function githubCheck(): Promise<SystemCheck> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token?.trim()) {
    return {
      id: "github",
      label: "GitHub access",
      command: "GH_TOKEN",
      state: "ready",
      version: "Environment credential",
      detail: "Ready for Contributions through an environment token.",
      helpUrl: "https://docs.github.com/en/rest/quickstart",
    };
  }

  const gh = await detectCommand(["gh"], githubCliCandidates());
  if (!gh) {
    return {
      id: "github",
      label: "GitHub access",
      command: "gh",
      state: "missing",
      version: null,
      detail: "Install GitHub CLI, then run `gh auth login` to enable Contributions.",
      helpUrl: "https://cli.github.com/",
    };
  }

  try {
    const { stdout } = await execFileAsync(gh.executable, ["auth", "token"], { timeout: 10_000 });
    if (stdout.trim()) {
      return {
        id: "github",
        label: "GitHub access",
        command: "gh",
        state: "ready",
        version: gh.version,
        detail: "Ready for Contributions through GitHub CLI.",
        helpUrl: "https://docs.github.com/en/rest/quickstart",
      };
    }
  } catch {
    // The CLI exists but does not currently have a usable credential.
  }
  return {
    id: "github",
    label: "GitHub access",
    command: "gh auth login",
    state: "action",
    version: gh.version,
    detail: "GitHub CLI is installed. Sign in with `gh auth login` to enable Contributions.",
    helpUrl: "https://docs.github.com/en/rest/quickstart",
  };
}

async function toolCheck(definition: ToolDefinition): Promise<SystemCheck> {
  const found = await detectCommand(definition.commands);
  return {
    id: definition.id,
    label: definition.label,
    command: definition.commands[0],
    state: found ? "ready" : "missing",
    version: found?.version ?? null,
    detail: found ? "Installed and available to azul-code." : definition.missingDetail,
    helpUrl: definition.helpUrl,
  };
}

export async function checkSystem(): Promise<SystemCheckSnapshot> {
  const checks = await Promise.all([githubCheck(), ...TOOL_DEFINITIONS.map(toolCheck)]);
  return { checkedAt: Date.now(), checks };
}
