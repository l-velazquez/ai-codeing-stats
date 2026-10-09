import type { Provider, TokenTotals } from "./types";

/** USD per million tokens, one price per token bucket. */
export interface TokenRates {
  readonly input: number;
  readonly cached: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
  readonly output: number;
}

export interface ModelRate extends TokenRates {
  /**
   * A request carrying more input than `from` bills every one of its tokens at
   * these rates, not just the tokens past the threshold.
   */
  readonly longContext?: { readonly from: number; readonly rates: TokenRates };
}

function withLongContext(rates: TokenRates, from: number, inputFactor: number, outputFactor: number): ModelRate {
  return {
    ...rates,
    longContext: {
      from,
      rates: {
        input: rates.input * inputFactor,
        cached: rates.cached * inputFactor,
        cacheWrite5m: rates.cacheWrite5m * inputFactor,
        cacheWrite1h: rates.cacheWrite1h * inputFactor,
        output: rates.output * outputFactor,
      },
    },
  };
}

// Documented for GPT-6 Astra, Sol, and Luna; older GPT models are assumed to
// share the tier until confirmed otherwise.
const gpt = (rates: TokenRates): ModelRate => withLongContext(rates, 272_000, 2, 1.5);

// USD per million tokens. Existing rates were last verified against official provider pricing
// on 2026-09-05; Claude Fable rates were verified against Anthropic pricing on 2026-09-14.
// GPT-6 Sol and Luna rates and long-context tiers were verified on 2026-09-23.
// Claude Opus 5.5 rates were verified against Anthropic pricing on 2026-09-24.
// GPT-6.1 Sol and the short-context GPT-5 family rates were verified on 2026-10-05.
// Claude Sonnet 5.5 rates were verified against Anthropic pricing on 2026-10-09.
// Claude Sonnet 5, Opus 4.5, Sonnet 4.5, and Haiku 4.5 and 5.5 were added, and every
// Claude rate re-verified, against Anthropic pricing on 2026-10-09.
// Used when live pricing is off, has not yet succeeded, or does not list a model.
const BUNDLED_RATES: Record<string, ModelRate> = {
  "gpt-6-astra": gpt({ input: 10, cached: 1, cacheWrite5m: 12.5, cacheWrite1h: 12.5, output: 50 }),
  "gpt-6.1-sol": gpt({ input: 2, cached: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 10 }),
  "gpt-6-sol": gpt({ input: 2, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 10 }),
  "gpt-6-luna": gpt({ input: 0.1, cached: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.125, output: 0.5 }),
  "gpt-5.6-sol": gpt({ input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20 }),
  "gpt-5.6": gpt({ input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20 }),
  "gpt-5.6-terra": gpt({ input: 2, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 12 }),
  "gpt-5.6-luna": gpt({ input: 0.2, cached: 0.02, cacheWrite5m: 0.25, cacheWrite1h: 0.25, output: 1.2 }),
  "gpt-5.5": gpt({ input: 5, cached: 0.5, cacheWrite5m: 5, cacheWrite1h: 5, output: 30 }),
  // The pro models publish no cached or cache-write rate, so cache tokens bill as plain input.
  "gpt-5.5-pro": gpt({ input: 30, cached: 30, cacheWrite5m: 30, cacheWrite1h: 30, output: 180 }),
  "gpt-5.4": gpt({ input: 2.5, cached: 0.25, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 15 }),
  "gpt-5.4-pro": gpt({ input: 30, cached: 30, cacheWrite5m: 30, cacheWrite1h: 30, output: 180 }),
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, cacheWrite5m: 0.75, cacheWrite1h: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cached: 0.02, cacheWrite5m: 0.2, cacheWrite1h: 0.2, output: 1.25 },
  "gpt-5.3-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "gpt-5.2-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "gpt-5.2": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "gpt-5.1": { input: 1.25, cached: 0.125, cacheWrite5m: 1.25, cacheWrite1h: 1.25, output: 10 },
  "gpt-5": { input: 1.25, cached: 0.125, cacheWrite5m: 1.25, cacheWrite1h: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, cached: 0.025, cacheWrite5m: 0.25, cacheWrite1h: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, cached: 0.005, cacheWrite5m: 0.05, cacheWrite1h: 0.05, output: 0.4 },
  "claude-fable-5": { input: 10, cached: 1, cacheWrite5m: 12.5, cacheWrite1h: 20, output: 50 },
  "claude-fable-5-1": { input: 10, cached: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20, output: 50 },
  "claude-opus-5-5": { input: 4, cached: 0.2, cacheWrite5m: 5, cacheWrite1h: 8, output: 20 },
  "claude-opus-5": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-8": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-7": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-6": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-5": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-sonnet-5-5": { input: 2, cached: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4, output: 10 },
  "claude-sonnet-5": { input: 2, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4, output: 10 },
  "claude-sonnet-4-6": { input: 3, cached: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, output: 15 },
  "claude-sonnet-4-5": { input: 3, cached: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, output: 15 },
  // Every Haiku 5.5 rate is 5x once a prompt passes 100,000 tokens.
  "claude-haiku-5-5": withLongContext({ input: 0.1, cached: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2, output: 0.5 }, 100_000, 5, 5),
  "claude-haiku-4-5": { input: 1, cached: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2, output: 5 },
};

/** One price list a model was billed at, starting at `since` (epoch ms; null means always). */
export interface RatePeriod {
  readonly since: number | null;
  readonly rate: ModelRate;
}

/** Each model's price lists, oldest first. */
export type RateHistory = Readonly<Record<string, readonly RatePeriod[]>>;

let remoteRates: RateHistory = {};

/**
 * Prices fetched at runtime take precedence over the bundled table. Models the
 * history does not cover keep their bundled rate.
 */
export function setRemoteRates(history: RateHistory): void {
  remoteRates = history;
}

export function normalizeModel(model: string): string {
  const trimmed = model.trim().toLowerCase();
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/** The rate a model billed at on `at`; a time before every known change uses the oldest one. */
export function getRate(model: string, at: number = Date.now()): ModelRate | null {
  const key = normalizeModel(model);
  const periods = remoteRates[key];
  if (periods === undefined || periods.length === 0) return BUNDLED_RATES[key] ?? null;
  let current = periods[0];
  for (const period of periods) {
    if (period.since === null || period.since <= at) current = period;
  }
  return current.rate;
}

// A tier derived by multiplying (1.2 * 1.5) and one published as 1.8 are the same price.
function samePrice(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function sameRates(a: TokenRates, b: TokenRates): boolean {
  return samePrice(a.input, b.input) && samePrice(a.cached, b.cached) && samePrice(a.cacheWrite5m, b.cacheWrite5m)
    && samePrice(a.cacheWrite1h, b.cacheWrite1h) && samePrice(a.output, b.output);
}

export function sameRate(a: ModelRate, b: ModelRate): boolean {
  if (!sameRates(a, b)) return false;
  if (a.longContext === undefined || b.longContext === undefined) return a.longContext === b.longContext;
  return a.longContext.from === b.longContext.from && sameRates(a.longContext.rates, b.longContext.rates);
}

/**
 * Folds a newly observed price list into the history. The first observation of a
 * model applies to all of its usage, since it corrects or fills in the bundled
 * table. A later change applies only from `at` onward, so a price cut does not
 * reprice usage that was billed before it.
 */
export function recordRates(history: RateHistory, observed: Readonly<Record<string, ModelRate>>, at: number): RateHistory {
  const next: Record<string, readonly RatePeriod[]> = { ...history };
  for (const [model, rate] of Object.entries(observed)) {
    const periods = history[model];
    if (periods === undefined || periods.length === 0) next[model] = [{ since: null, rate }];
    else if (!sameRate(periods[periods.length - 1].rate, rate)) next[model] = [...periods, { since: at, rate }];
  }
  return next;
}

function inputTokensOf(tokens: TokenTotals): number {
  return tokens.uncachedInput + tokens.cachedInput + tokens.cacheWrite5m + tokens.cacheWrite1h;
}

/** The rates a single request actually bills at, once its context length is known. */
export function effectiveRate(rate: ModelRate, tokens: TokenTotals): TokenRates {
  const tier = rate.longContext;
  if (tier === undefined || inputTokensOf(tokens) <= tier.from) return rate;
  return tier.rates;
}

export function priceTokens(
  model: string,
  tokens: TokenTotals,
  reportedCost: number | null,
  at?: number,
): { cost: number; savings: number; priced: boolean } {
  if (reportedCost !== null && Number.isFinite(reportedCost) && reportedCost >= 0) {
    return { cost: reportedCost, savings: 0, priced: true };
  }

  const base = getRate(model, at);
  if (base === null) return { cost: 0, savings: 0, priced: false };
  const rate = effectiveRate(base, tokens);

  const cost =
    (tokens.uncachedInput * rate.input +
      tokens.cachedInput * rate.cached +
      tokens.cacheWrite5m * rate.cacheWrite5m +
      tokens.cacheWrite1h * rate.cacheWrite1h +
      tokens.output * rate.output) /
    1_000_000;
  const uncachedBaseline =
    ((tokens.cachedInput + tokens.cacheWrite5m + tokens.cacheWrite1h) * rate.input) / 1_000_000;
  const actualCached =
    (tokens.cachedInput * rate.cached +
      tokens.cacheWrite5m * rate.cacheWrite5m +
      tokens.cacheWrite1h * rate.cacheWrite1h) /
    1_000_000;

  return { cost, savings: Math.max(0, uncachedBaseline - actualCached), priced: true };
}

export function providerLabel(provider: Provider): string {
  if (provider === "codex") return "Codex";
  if (provider === "claude") return "Claude Code";
  return "OpenCode";
}
