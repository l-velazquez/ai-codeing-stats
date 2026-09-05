import type { Provider, TokenTotals } from "./types";

export interface ModelRate {
  readonly input: number;
  readonly cached: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
  readonly output: number;
}

// USD per million tokens. Last verified against official provider pricing on 2026-08-29.
const RATES: Record<string, ModelRate> = {
  "gpt-5.6-sol": { input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20 },
  "gpt-5.6": { input: 4, cached: 0.4, cacheWrite5m: 5, cacheWrite1h: 5, output: 20 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 2.5, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, cacheWrite5m: 0.25, cacheWrite1h: 0.25, output: 1.2 },
  "gpt-5.5": { input: 5, cached: 0.5, cacheWrite5m: 5, cacheWrite1h: 5, output: 30 },
  "gpt-5.3-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
  "gpt-5.2-codex": { input: 1.75, cached: 0.175, cacheWrite5m: 1.75, cacheWrite1h: 1.75, output: 14 },
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

export function priceTokens(
  model: string,
  tokens: TokenTotals,
  reportedCost: number | null,
): { cost: number; savings: number; priced: boolean } {
  if (reportedCost !== null && Number.isFinite(reportedCost) && reportedCost >= 0) {
    return { cost: reportedCost, savings: 0, priced: true };
  }

  const rate = getRate(model);
  if (rate === null) return { cost: 0, savings: 0, priced: false };

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
