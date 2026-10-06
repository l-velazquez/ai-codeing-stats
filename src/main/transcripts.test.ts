import { describe, expect, it } from "vitest";
import { getRate, priceTokens } from "../shared/pricing";
import { parseCodexSubscription } from "./scanner";
import { createCodexState, parseClaudeLine, parseCodexLine } from "./transcripts";

describe("Codex transcript parsing", () => {
  it("attributes the latest model and removes cached input from uncached input", () => {
    const state = createCodexState();
    parseCodexLine(
      JSON.stringify({
        timestamp: "2026-08-20T12:00:00.000Z",
        type: "session_meta",
        payload: { id: "session-1", cwd: "/tmp/project" },
      }),
      state,
    );
    parseCodexLine(
      JSON.stringify({
        timestamp: "2026-08-20T12:00:01.000Z",
        type: "turn_context",
        payload: { model: "gpt-5.6-sol" },
      }),
      state,
    );
    const line = JSON.stringify({
      timestamp: "2026-08-20T12:00:10.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 1_000,
            cached_input_tokens: 800,
            cache_write_input_tokens: 0,
            output_tokens: 100,
            reasoning_output_tokens: 40,
          },
        },
      },
    });

    const record = parseCodexLine(line, state);
    expect(record).toMatchObject({
      model: "gpt-5.6-sol",
      sessionId: "session-1",
      workspace: "/tmp/project",
      tokens: { uncachedInput: 200, cachedInput: 800, output: 100, reasoning: 40 },
    });
    expect(parseCodexLine(line, state)).toBeNull();
  });

  it("reads current subscription windows without account credentials", () => {
    const usage = parseCodexSubscription(JSON.stringify({
      timestamp: "2026-09-02T18:59:38.127Z",
      payload: {
        rate_limits: {
          plan_type: "team",
          primary: { used_percent: 4, window_minutes: 300, resets_at: 1_788_393_265 },
          secondary: { used_percent: 37, window_minutes: 10_080, resets_at: 1_788_752_500 },
        },
      },
    }));

    expect(usage).toMatchObject({
      provider: "codex",
      state: "live",
      plan: "team",
      windows: [
        { label: "Session limit", usedPercent: 4, windowMinutes: 300 },
        { label: "Weekly limit", usedPercent: 37, windowMinutes: 10_080 },
      ],
    });
  });
});

describe("Claude transcript parsing", () => {
  it("preserves 5-minute and 1-hour cache creation separately", () => {
    const record = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-08-20T12:00:10.000Z",
        requestId: "request-1",
        sessionId: "session-2",
        cwd: "/tmp/claude-project",
        message: {
          id: "message-1",
          model: "claude-opus-5",
          usage: {
            input_tokens: 20,
            cache_read_input_tokens: 500,
            cache_creation_input_tokens: 300,
            output_tokens: 90,
            cache_creation: {
              ephemeral_5m_input_tokens: 100,
              ephemeral_1h_input_tokens: 200,
            },
          },
        },
      }),
    );

    expect(record).toMatchObject({
      dedupeKey: "message-1:request-1",
      tokens: { uncachedInput: 20, cachedInput: 500, cacheWrite5m: 100, cacheWrite1h: 200 },
    });
  });
});

describe("pricing", () => {
  it.each([
    ["gpt-6.1-sol", 2, 0.1, 2.5, 10],
    ["gpt-6-sol", 2, 0.2, 2.5, 10],
    ["gpt-6-luna", 0.1, 0.01, 0.125, 0.5],
  ])("prices %s at its published Standard rates", (model, input, cached, cacheWrite, output) => {
    expect(getRate(`openai/${model}`)).toEqual({
      input,
      cached,
      cacheWrite5m: cacheWrite,
      cacheWrite1h: cacheWrite,
      output,
      longContextFrom: 272_000,
    });

    const tokens = {
      uncachedInput: 152_000,
      cachedInput: 100_000,
      cacheWrite5m: 10_000,
      cacheWrite1h: 10_000,
      output: 10_000,
      reasoning: 0,
    };
    expect(priceTokens(model, tokens, null).cost).toBeCloseTo(
      (152_000 * input + 100_000 * cached + 20_000 * cacheWrite + 10_000 * output) / 1_000_000,
    );
    expect(priceTokens(model, { ...tokens, uncachedInput: 152_001 }, null).cost).toBeCloseTo(
      (152_001 * input * 2 + 100_000 * cached * 2 + 20_000 * cacheWrite * 2 + 10_000 * output * 1.5) / 1_000_000,
    );
  });

  it("uses Anthropic's cache rates for Claude Fable 5 and 5.1", () => {
    expect(getRate("claude-fable-5")).toEqual({
      input: 10,
      cached: 1,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
      output: 50,
    });
    expect(getRate("claude-fable-5-1")).toEqual({
      input: 10,
      cached: 0.25,
      cacheWrite5m: 12.5,
      cacheWrite1h: 20,
      output: 50,
    });
  });

  it.each([
    ["gpt-5.4-mini", 0.75, 0.075, 4.5],
    ["gpt-5.2", 1.75, 0.175, 14],
    ["gpt-5", 1.25, 0.125, 10],
    ["gpt-5-mini", 0.25, 0.025, 2],
  ])("prices short-context %s without a long-context tier", (model, input, cached, output) => {
    expect(getRate(model)).toEqual({ input, cached, cacheWrite5m: input, cacheWrite1h: input, output });
  });

  it("prices Claude Opus 5.5 with its published cache rates", () => {
    expect(getRate("anthropic/claude-opus-5-5")).toEqual({
      input: 4,
      cached: 0.2,
      cacheWrite5m: 5,
      cacheWrite1h: 8,
      output: 20,
    });
    const priced = priceTokens("claude-opus-5-5", {
      uncachedInput: 100_000,
      cachedInput: 100_000,
      cacheWrite5m: 10_000,
      cacheWrite1h: 10_000,
      output: 10_000,
      reasoning: 0,
    }, null);
    expect(priced.cost).toBeCloseTo(0.75);
    expect(priced.savings).toBeCloseTo(0.33);
    expect(priced.priced).toBe(true);
  });

  it("uses discounted cache reads and reports savings", () => {
    const priced = priceTokens(
      "gpt-5.6-sol",
      {
        uncachedInput: 100_000,
        cachedInput: 100_000,
        cacheWrite5m: 0,
        cacheWrite1h: 0,
        output: 10_000,
        reasoning: 5_000,
      },
      null,
    );
    expect(priced.cost).toBeCloseTo(0.64);
    expect(priced.savings).toBeCloseTo(0.36);
    expect(priced.priced).toBe(true);
  });

  it("bills a long-context request at the higher tier for the whole request", () => {
    const tokens = {
      uncachedInput: 200_000,
      cachedInput: 200_000,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
      output: 10_000,
      reasoning: 5_000,
    };
    const priced = priceTokens("gpt-6-astra", tokens, null);
    // 400K input is past the 272K threshold: input rates double, output is 1.5x.
    expect(priced.cost).toBeCloseTo(200_000 * 20e-6 + 200_000 * 2e-6 + 10_000 * 75e-6);
  });

  it("leaves a request under the threshold on standard rates", () => {
    const priced = priceTokens(
      "gpt-6-astra",
      { uncachedInput: 200_000, cachedInput: 50_000, cacheWrite5m: 0, cacheWrite1h: 0, output: 10_000, reasoning: 0 },
      null,
    );
    expect(priced.cost).toBeCloseTo(200_000 * 10e-6 + 50_000 * 1e-6 + 10_000 * 50e-6);
  });
});
