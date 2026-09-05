import type { TokenTotals } from "./types";

export const EMPTY_TOKENS: TokenTotals = {
  uncachedInput: 0,
  cachedInput: 0,
  cacheWrite5m: 0,
  cacheWrite1h: 0,
  output: 0,
  reasoning: 0,
};

export function addTokens(a: TokenTotals, b: TokenTotals): TokenTotals {
  return {
    uncachedInput: a.uncachedInput + b.uncachedInput,
    cachedInput: a.cachedInput + b.cachedInput,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
  };
}

export function totalTokens(tokens: TokenTotals): number {
  return (
    tokens.uncachedInput +
    tokens.cachedInput +
    tokens.cacheWrite5m +
    tokens.cacheWrite1h +
    tokens.output
  );
}
