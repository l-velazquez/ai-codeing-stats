import { describe, expect, it } from "vitest";
import type { PricingStatus } from "@shared/types";
import { pricingStatusLine } from "./PricingSettings";

const now = Date.UTC(2026, 9, 13, 9);
const status = (patch: Partial<PricingStatus>): PricingStatus => ({
  source: "models.dev", enabled: true, checkedAt: now - 3 * 86_400_000, models: 66, error: null, offline: false, ...patch,
});

describe("pricingStatusLine", () => {
  it("says when offline prices were saved", () => {
    expect(pricingStatusLine(status({ offline: true, error: "No internet connection." }), now))
      .toBe("You're offline, so azul-code is using the prices it saved 3d ago for 66 models. It tries again every 15 minutes.");
  });

  it("falls back to bundled prices offline before any check succeeded", () => {
    expect(pricingStatusLine(status({ source: "bundled", models: 0, checkedAt: null, offline: true }), now))
      .toContain("using the prices bundled with this version");
  });

  it("reports a normal check", () => {
    expect(pricingStatusLine(status({ checkedAt: now - 20 * 60_000 }), now)).toBe("66 models priced from models.dev. Checked 20m ago.");
  });
});
