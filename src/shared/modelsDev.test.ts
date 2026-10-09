import { describe, expect, it } from "vitest";
import { parseModelRate, ratesFromModelsDev } from "./modelsDev";

const catalog = {
  anthropic: {
    models: {
      "claude-sonnet-5-5": { cost: { input: 2, output: 10, cache_read: 0.1, cache_write: 2.5 } },
      "claude-haiku-5-5": {
        cost: {
          input: 0.1, output: 0.5, cache_read: 0.01, cache_write: 0.125,
          tiers: [{ input: 0.5, output: 2.5, cache_read: 0.05, cache_write: 0.625, tier: { type: "context", size: 100_000 } }],
        },
      },
    },
  },
  openai: {
    models: {
      "gpt-5.5-pro": { cost: { input: 30, output: 180 } },
      "gpt-broken": { cost: { input: -1, output: 10 } },
      "gpt-huge": { cost: { input: 1e9, output: 10 } },
      "gpt-odd-tier": { cost: { input: 1, output: 2, tiers: [{ input: 2, output: 4, tier: { type: "time_of_day", size: 1 } }] } },
      "text-embedding-3-small": { cost: { input: 0.02, output: 0 } },
    },
  },
  // Resellers set their own prices, so they never override a provider's list price.
  openrouter: { models: { "claude-sonnet-5-5": { cost: { input: 99, output: 99 } } } },
};

describe("ratesFromModelsDev", () => {
  it("reads Anthropic prices and derives the 1-hour cache write as 2x input", () => {
    expect(ratesFromModelsDev(catalog)?.["claude-sonnet-5-5"]).toEqual({
      input: 2, cached: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4, output: 10,
    });
  });

  it("keeps a context tier's own published rates", () => {
    expect(ratesFromModelsDev(catalog)?.["claude-haiku-5-5"]).toEqual({
      input: 0.1, cached: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2, output: 0.5,
      longContext: { from: 100_000, rates: { input: 0.5, cached: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1, output: 2.5 } },
    });
  });

  it("bills cache tokens as input when a model publishes no cache price", () => {
    expect(ratesFromModelsDev(catalog)?.["gpt-5.5-pro"]).toEqual({
      input: 30, cached: 30, cacheWrite5m: 30, cacheWrite1h: 30, output: 180,
    });
  });

  it("leaves out negative, implausible, and unrecognised prices", () => {
    const rates = ratesFromModelsDev(catalog) ?? {};
    expect(rates["gpt-broken"]).toBeUndefined();
    expect(rates["gpt-huge"]).toBeUndefined();
    expect(rates["gpt-odd-tier"]).toBeUndefined();
    expect(rates["text-embedding-3-small"]).toBeDefined();
  });

  it("rejects a response that is not a catalog", () => {
    for (const input of [null, [], "html", {}, { anthropic: { models: {} } }]) {
      expect(ratesFromModelsDev(input)).toBeNull();
    }
  });
});

describe("parseModelRate", () => {
  it("round-trips a stored rate and rejects a tampered one", () => {
    const rate = ratesFromModelsDev(catalog)?.["claude-haiku-5-5"];
    expect(parseModelRate(JSON.parse(JSON.stringify(rate)))).toEqual(rate);
    expect(parseModelRate({ ...rate, output: "free" })).toBeNull();
    expect(parseModelRate({ ...rate, longContext: { from: -5, rates: rate?.longContext?.rates } })).toBeNull();
  });
});
