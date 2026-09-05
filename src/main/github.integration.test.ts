import { describe, expect, it } from "vitest";
import { fetchGithubMonth } from "./github";

describe.skipIf(process.env.RUN_GITHUB_SCAN !== "1")("GitHub integration", () => {
  it("loads the authenticated user's current contribution month", async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const snapshot = await fetchGithubMonth(month, true);

    expect(snapshot.state).toBe("ok");
    expect(snapshot.login).not.toBe("");
    expect(snapshot.login).not.toBe("demo");
    expect(snapshot.month).toBe(month);
    expect(snapshot.days.length).toBeGreaterThanOrEqual(28);
  }, 120_000);
});
