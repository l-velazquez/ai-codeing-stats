import { describe, expect, it } from "vitest";
import { ago } from "./format";

describe("ago", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  it("never says \"now ago\"", () => {
    expect(ago(now - 10_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5m ago");
    expect(ago(now - 3 * 86_400_000, now)).toBe("3d ago");
  });

  it("names the date once it is older than a month", () => {
    expect(ago(now - 45 * 86_400_000, now)).toMatch(/^on \D+ \d+/);
  });
});
