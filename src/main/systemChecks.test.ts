import { describe, expect, it } from "vitest";
import { commandCandidates } from "./systemChecks";

describe("commandCandidates", () => {
  it("includes the command, PATH entries, and GUI-app fallback locations", async () => {
    const candidates = await commandCandidates("codex", "/custom/bin:/usr/bin", "/Users/example");
    expect(candidates).toContain("codex");
    expect(candidates).toContain("/custom/bin/codex");
    expect(candidates).toContain("/opt/homebrew/bin/codex");
    expect(candidates).toContain("/Users/example/.local/bin/codex");
    expect(candidates).toContain("/Users/example/.volta/bin/codex");
  });

  it("ignores relative PATH entries and removes duplicates", async () => {
    const candidates = await commandCandidates("gh", "/usr/bin:relative:/usr/bin", "/Users/example");
    expect(candidates.some((candidate) => candidate.startsWith("relative"))).toBe(false);
    expect(candidates.filter((candidate) => candidate === "/usr/bin/gh")).toHaveLength(1);
  });
});
