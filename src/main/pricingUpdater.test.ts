import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRate, setRemoteRates } from "../shared/pricing";
import { PricingUpdater } from "./pricingUpdater";

function catalog(sonnetCacheRead: number) {
  return {
    anthropic: { models: { "claude-sonnet-5-5": { cost: { input: 2, output: 10, cache_read: sonnetCacheRead, cache_write: 2.5 } } } },
    openai: { models: { "gpt-4.1": { cost: { input: 2, output: 8, cache_read: 0.5 } } } },
  };
}

function response(body: unknown, init: { status?: number; etag?: string } = {}): Response {
  return new Response(init.status === 304 ? null : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.etag ? { etag: init.etag } : {},
  });
}

function freshPath(): string {
  return join(mkdtempSync(join(tmpdir(), "azul-code-pricing-")), "pricing.json");
}

let updater: PricingUpdater | null = null;
afterEach(() => {
  updater?.stop();
  updater = null;
  setRemoteRates({});
  vi.useRealTimers();
});

describe("PricingUpdater", () => {
  it("fetches on first enable, applies the prices, and caches them with the ETag", async () => {
    const path = freshPath();
    const fetch = vi.fn(async () => response(catalog(0.1), { etag: '"v1"' }));
    const onChange = vi.fn();
    updater = new PricingUpdater({ path, fetch, onChange, now: () => 1_000 });
    updater.setEnabled(true);
    await updater.update();

    expect(getRate("gpt-4.1")?.output).toBe(8);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(updater.status()).toMatchObject({ source: "models.dev", enabled: true, checkedAt: 1_000, models: 2, error: null });
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ etag: '"v1"', checkedAt: 1_000 });
  });

  it("revalidates with the ETag and changes nothing on 304", async () => {
    const path = freshPath();
    const fetch = vi.fn(async () => response(catalog(0.1), { etag: '"v1"' }));
    updater = new PricingUpdater({ path, fetch, onChange: vi.fn() });
    updater.setEnabled(true);
    await updater.update();
    updater.stop();

    const revalidate = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["If-None-Match"]).toBe('"v1"');
      return response(null, { status: 304 });
    });
    const onChange = vi.fn();
    updater = new PricingUpdater({ path, fetch: revalidate, onChange });
    updater.setEnabled(true);
    // Loading the cache applies it once; the 304 that follows does not.
    expect(onChange).toHaveBeenCalledTimes(1);
    await updater.update();
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("records a price change from the moment it was seen", async () => {
    const path = freshPath();
    let now = 1_000;
    let body = catalog(0.1);
    updater = new PricingUpdater({ path, fetch: async () => response(body), onChange: vi.fn(), now: () => now });
    updater.setEnabled(true);
    await updater.update();
    now = 5_000;
    body = catalog(0.05);
    await updater.update();

    expect(getRate("claude-sonnet-5-5", 4_999)?.cached).toBe(0.1);
    expect(getRate("claude-sonnet-5-5", 5_000)?.cached).toBe(0.05);
  });

  it("keeps the last good prices when a check fails", async () => {
    const path = freshPath();
    let fail = false;
    updater = new PricingUpdater({
      path,
      fetch: async () => { if (fail) throw new Error("offline"); return response(catalog(0.1)); },
      onChange: vi.fn(),
    });
    updater.setEnabled(true);
    await updater.update();
    fail = true;
    await updater.update();

    expect(getRate("gpt-4.1")?.output).toBe(8);
    expect(updater.status()).toMatchObject({ source: "models.dev", error: "offline" });
  });

  it("rejects a response with no usable prices", async () => {
    updater = new PricingUpdater({ path: freshPath(), fetch: async () => response({ html: true }), onChange: vi.fn() });
    updater.setEnabled(true);
    await updater.update();
    expect(getRate("gpt-4.1")).toBeNull();
    expect(updater.status()).toMatchObject({ source: "bundled", error: "models.dev returned no usable prices." });
  });

  it("ignores a cache file that was tampered with", () => {
    const path = freshPath();
    writeFileSync(path, JSON.stringify({
      version: 1, etag: null, checkedAt: Date.now(),
      history: { "gpt-4.1": [{ since: null, rate: { input: "free", cached: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0 } }] },
    }));
    const fetch = vi.fn(async () => response(catalog(0.1)));
    updater = new PricingUpdater({ path, fetch, onChange: vi.fn() });
    updater.setEnabled(true);
    expect(getRate("gpt-4.1")).toBeNull();
  });

  it("goes back to bundled prices and stops fetching when turned off", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => response(catalog(0.1)));
    const onChange = vi.fn();
    updater = new PricingUpdater({ path: freshPath(), fetch, onChange });
    updater.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(getRate("gpt-4.1")).not.toBeNull();

    updater.setEnabled(false);
    expect(getRate("gpt-4.1")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(updater.status()).toMatchObject({ source: "bundled", enabled: false });
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
