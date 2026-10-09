import { normalizeModel, type ModelRate, type TokenRates } from "./pricing";

/** models.dev's catalog: every provider, model, and USD-per-million-token price. */
export const MODELS_DEV_URL = "https://models.dev/api.json";

// First-party list prices only. Resellers on models.dev list their own markups,
// and OpenCode reports its own cost for the requests it routes through them.
const PROVIDERS = ["anthropic", "openai"] as const;

// Well above any published rate. A larger value is a data error, and pricing a
// month of usage with it would swamp every real total.
const MAX_RATE = 1_000;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function price(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_RATE ? value : null;
}

/**
 * models.dev lists one cache-write price, the 5-minute one. Anthropic bills a
 * 1-hour write at 2x base input on every model; OpenAI has no 1-hour cache, so
 * its value is never used and mirrors the 5-minute price.
 */
function rates(cost: Json, provider: typeof PROVIDERS[number]): TokenRates | null {
  const input = price(cost.input);
  const output = price(cost.output);
  if (input === null || output === null) return null;
  // An absent cache price means the provider bills cache tokens as plain input.
  const cached = cost.cache_read === undefined ? input : price(cost.cache_read);
  const cacheWrite5m = cost.cache_write === undefined ? input : price(cost.cache_write);
  if (cached === null || cacheWrite5m === null) return null;
  const cacheWrite1h = provider === "anthropic" ? Math.min(input * 2, MAX_RATE) : cacheWrite5m;
  return { input, cached, cacheWrite5m, cacheWrite1h, output };
}

function modelRate(cost: unknown, provider: typeof PROVIDERS[number]): ModelRate | null {
  if (!isRecord(cost)) return null;
  const base = rates(cost, provider);
  if (base === null) return null;
  if (!Array.isArray(cost.tiers)) return base;
  // Only a context-length tier changes what a request bills; anything else is a
  // shape this parser does not understand, so the model is skipped rather than
  // priced at a rate that may not apply.
  if (cost.tiers.length === 0) return base;
  if (cost.tiers.length > 1) return null;
  const tier: unknown = cost.tiers[0];
  if (!isRecord(tier) || !isRecord(tier.tier) || tier.tier.type !== "context") return null;
  const from = tier.tier.size;
  if (typeof from !== "number" || !Number.isInteger(from) || from <= 0) return null;
  const tierRates = rates(tier, provider);
  return tierRates === null ? null : { ...base, longContext: { from, rates: tierRates } };
}

/**
 * Reads the first-party prices out of a models.dev catalog. Models with missing
 * or implausible prices are left out so the bundled table keeps pricing them;
 * null means the response is not a usable catalog at all.
 */
export function ratesFromModelsDev(catalog: unknown): Record<string, ModelRate> | null {
  if (!isRecord(catalog)) return null;
  const found: Record<string, ModelRate> = {};
  for (const provider of PROVIDERS) {
    const entry = catalog[provider];
    if (!isRecord(entry) || !isRecord(entry.models)) continue;
    for (const [id, model] of Object.entries(entry.models)) {
      if (!isRecord(model)) continue;
      const rate = modelRate(model.cost, provider);
      if (rate !== null) found[normalizeModel(id)] = rate;
    }
  }
  return Object.keys(found).length > 0 ? found : null;
}

function tokenRates(value: unknown): TokenRates | null {
  if (!isRecord(value)) return null;
  const input = price(value.input);
  const cached = price(value.cached);
  const cacheWrite5m = price(value.cacheWrite5m);
  const cacheWrite1h = price(value.cacheWrite1h);
  const output = price(value.output);
  if (input === null || cached === null || cacheWrite5m === null || cacheWrite1h === null || output === null) return null;
  return { input, cached, cacheWrite5m, cacheWrite1h, output };
}

/** Checks a rate in our own stored shape, such as one read back from the disk cache. */
export function parseModelRate(value: unknown): ModelRate | null {
  const base = tokenRates(value);
  if (base === null || !isRecord(value)) return null;
  if (value.longContext === undefined) return base;
  const tier = value.longContext;
  if (!isRecord(tier) || typeof tier.from !== "number" || !Number.isInteger(tier.from) || tier.from <= 0) return null;
  const rates = tokenRates(tier.rates);
  return rates === null ? null : { ...base, longContext: { from: tier.from, rates } };
}
