import type { Provider, TokenTotals } from "./types";

export interface ModelRate {
  readonly input: number;
  readonly cached: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
  readonly output: number;
  /** Requests carrying more input than this bill at the provider's long-context tier. */
  readonly longContextFrom?: number;
}

// A request above the threshold is billed at the higher tier in full, not just for
// the tokens past it: 2x on every input rate, 1.5x on output.
const LONG_CONTEXT_INPUT_FACTOR = 2;
const LONG_CONTEXT_OUTPUT_FACTOR = 1.5;
// Documented for gpt-6-astra; the rest of the GPT line publishes the same tier
// shape, so they are assumed to share the threshold until confirmed otherwise.
const GPT_LONG_CONTEXT_FROM = 272_000;

// USD per million tokens. Existing rates were last verified against official provider pricing
// on 2026-09-05; Claude Fable rates were verified against Anthropic pricing on 2026-09-14.
const RATES: Record<string, ModelRate> = {
  "gpt-6-astra": { input: 10, cached: 1, cacheWrite5m: 12.5, cacheWrite1h: 12.5, output: 50, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.6-sol": { input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.6": { input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.6-terra": { input: 2, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 12, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, cacheWrite5m: 0.25, cacheWrite1h: 0.25, output: 1.2, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.5": { input: 5, cached: 0.5, cacheWrite5m: 5, cacheWrite1h: 5, output: 30, longContextFrom: GPT_LONG_CONTEXT_FROM },
  // The pro models publish no cached or cache-write rate, so cache tokens bill as plain input.
  "gpt-5.5-pro": { input: 30, cached: 30, cacheWrite5m: 30, cacheWrite1h: 30, output: 180, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.4": { input: 2.5, cached: 0.25, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 15, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.4-pro": { input: 30, cached: 30, cacheWrite5m: 30, cacheWrite1h: 30, output: 180, longContextFrom: GPT_LONG_CONTEXT_FROM },
  "gpt-5.3-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "gpt-5.2-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "claude-fable-5": { input: 10, cached: 1, cacheWrite5m: 12.5, cacheWrite1h: 20, output: 50 },
  "claude-fable-5-1": { input: 10, cached: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20, output: 50 },
  "claude-opus-5": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-8": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-7": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-opus-4-6": { input: 5, cached: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, output: 25 },
  "claude-sonnet-4-6": { input: 3, cached: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, output: 15 },
};

function normalize(model: string): string {
  const trimmed = model.trim().toLowerCase();
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export function getRate(model: string): ModelRate | null {
  return RATES[normalize(model)] ?? null;
}

function inputTokensOf(tokens: TokenTotals): number {
  return tokens.uncachedInput + tokens.cachedInput + tokens.cacheWrite5m + tokens.cacheWrite1h;
}

/** The rate a single request actually bills at, once its context length is known. */
export function effectiveRate(rate: ModelRate, tokens: TokenTotals): ModelRate {
  if (rate.longContextFrom === undefined) return rate;
  if (inputTokensOf(tokens) <= rate.longContextFrom) return rate;
  return {
    ...rate,
    input: rate.input * LONG_CONTEXT_INPUT_FACTOR,
    cached: rate.cached * LONG_CONTEXT_INPUT_FACTOR,
    cacheWrite5m: rate.cacheWrite5m * LONG_CONTEXT_INPUT_FACTOR,
    cacheWrite1h: rate.cacheWrite1h * LONG_CONTEXT_INPUT_FACTOR,
    output: rate.output * LONG_CONTEXT_OUTPUT_FACTOR,
  };
}

export function priceTokens(
  model: string,
  tokens: TokenTotals,
  reportedCost: number | null,
): { cost: number; savings: number; priced: boolean } {
  if (reportedCost !== null && Number.isFinite(reportedCost) && reportedCost >= 0) {
    return { cost: reportedCost, savings: 0, priced: true };
  }

  const base = getRate(model);
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
