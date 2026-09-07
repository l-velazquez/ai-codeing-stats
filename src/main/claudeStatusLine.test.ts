import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installClaudeStatusLine, parseClaudeStatusLineSubscription } from "./claudeStatusLine";

function runWrapper(wrapper: string, home: string, input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(wrapper, [], { env: { ...process.env, HOME: home }, stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Wrapper exited ${code}: ${stderr}`)));
    child.stdin.end(input);
  });
}

describe("Claude Code status-line allowance", () => {
  it("parses independently optional 5-hour and weekly windows", () => {
    const now = 1_800_000_000_000;
    const usage = parseClaudeStatusLineSubscription(JSON.stringify({
      five_hour: { used_percentage: 23.5, resets_at: now / 1_000 + 3_600 },
    }), now - 1_000, true, now);

    expect(usage).toMatchObject({
      provider: "claude",
      state: "live",
      updatedAt: now - 1_000,
      windows: [{ label: "5-hour limit", usedPercent: 23.5, windowMinutes: 300 }],
      capture: { kind: "claude-statusline", state: "active" },
    });
  });

  it("does not present an expired capture as current usage", () => {
    const now = 1_800_000_000_000;
    const usage = parseClaudeStatusLineSubscription(JSON.stringify({
      rate_limits: {
        five_hour: { used_percentage: 92, resets_at: now / 1_000 - 1 },
        seven_day: { used_percentage: 67, resets_at: now / 1_000 - 1 },
      },
    }), now - 60_000, true, now);

    expect(usage).toMatchObject({
      state: "unavailable",
      windows: [],
      capture: { state: "waiting" },
    });
    expect(usage.detail).toContain("expired");
  });

  it("installs atomically and preserves an existing status-line command", async () => {
    const claudeHome = await mkdtemp(join(tmpdir(), "azul-code-claude-"));
    const settingsPath = join(claudeHome, "settings.json");
    await writeFile(settingsPath, JSON.stringify({
      permissions: { allow: ["Read"] },
      statusLine: { type: "command", command: "~/.claude/my-status.sh", padding: 2 },
    }));

    const usage = await installClaudeStatusLine(claudeHome);
    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
      permissions: unknown;
      statusLine: { command: string; padding: number };
    };
    const previous = await readFile(join(claudeHome, "azul-code", "previous-statusline-command"), "utf8");
    const wrapper = await readFile(join(claudeHome, "azul-code", "azul-code-statusline.sh"), "utf8");

    expect(settings.permissions).toEqual({ allow: ["Read"] });
    expect(settings.statusLine.padding).toBe(2);
    expect(settings.statusLine.command).toContain("azul-code-statusline.sh");
    expect(previous).toBe("~/.claude/my-status.sh");
    expect(wrapper).toContain("plutil -extract rate_limits");
    expect(usage.capture?.state).toBe("waiting");
  });

  it("captures only the rate-limit object from Claude's full status payload", async () => {
    const home = await mkdtemp(join(tmpdir(), "azul-code-home-"));
    const claudeHome = join(home, ".claude");
    await installClaudeStatusLine(claudeHome);
    const wrapper = join(claudeHome, "azul-code", "azul-code-statusline.sh");
    const nowSeconds = Math.floor(Date.now() / 1_000);

    await runWrapper(wrapper, home, JSON.stringify({
      session_id: "must-not-be-retained",
      cwd: "/private/project",
      transcript_path: "/private/transcript.jsonl",
      rate_limits: {
        five_hour: { used_percentage: 12.5, resets_at: nowSeconds + 3_600 },
        seven_day: { used_percentage: 44, resets_at: nowSeconds + 86_400 },
      },
    }));

    const captured = JSON.parse(await readFile(join(claudeHome, "azul-code", "rate-limits.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(captured).sort()).toEqual(["five_hour", "seven_day"]);
    expect(JSON.stringify(captured)).not.toContain("must-not-be-retained");
    expect(JSON.stringify(captured)).not.toContain("/private/");
  });
});
