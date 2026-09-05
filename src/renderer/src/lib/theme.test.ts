import { describe, expect, it } from "vitest";
import { nextTheme, THEME_ORDER } from "./theme";

describe("nextTheme", () => {
  it("cycles dark -> light -> system -> dark", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("system");
    expect(nextTheme("system")).toBe("dark");
  });

  it("returns to the start after a full cycle", () => {
    const seen = THEME_ORDER.reduce<string[]>((acc) => [...acc, nextTheme(acc.at(-1) as never ?? "dark")], ["dark"]);
    expect(seen.at(-1)).toBe("dark");
  });
});
