import { EMPTY_TOKENS } from "../../shared/tokenMath";
import type { Provider, RangeKey, StatsSnapshot, TokenTotals } from "../../shared/types";

const DAY = 86_400_000;

function tokens(input: number, cached: number, output: number, reasoning = 0): TokenTotals {
  return {
    uncachedInput: input,
    cachedInput: cached,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    output,
    reasoning,
  };
}

export function demoSnapshot(range: RangeKey): StatsSnapshot {
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "90d" ? 90 : range === "all" ? 120 : 30;
  const providers: Provider[] = ["codex", "claude", "opencode"];
  const daily = Array.from({ length: days }, (_, index) => {
    const wave = 4.4 + Math.sin(index * 0.72) * 2.1 + ((index * 17) % 7) * 0.38;
    const quiet = index % 7 === 0 || index % 7 === 6 ? 0.3 : 1;
    const cost = Math.max(0, wave * quiet);
    return {
      date: new Date(now - (days - index - 1) * DAY).toISOString().slice(0, 10),
      cost,
      tokens: Math.round(cost * 890_000),
      sessions: Math.max(0, Math.round(cost * 1.5)),
      byProvider: { codex: cost * 0.47, claude: cost * 0.45, opencode: cost * 0.08 },
    };
  });
  const summaryTokens = tokens(9_482_400, 57_324_000, 1_249_800, 504_100);
  const models = [
    { model: "claude-opus-5", provider: "claude" as const, cost: 72.84, totalTokens: 26_800_000, sessions: 38, records: 182, tokens: tokens(2_200_000, 23_600_000, 1_000_000), savings: 105.2, priced: true },
    { model: "gpt-5.6-sol", provider: "codex" as const, cost: 54.29, totalTokens: 32_400_000, sessions: 41, records: 224, tokens: tokens(3_800_000, 28_000_000, 600_000), savings: 101.4, priced: true },
    { model: "gpt-5.5", provider: "codex" as const, cost: 21.53, totalTokens: 7_100_000, sessions: 14, records: 63, tokens: tokens(1_400_000, 5_300_000, 400_000), savings: 23.9, priced: true },
    { model: "openai/gpt-5.5", provider: "opencode" as const, cost: 6.71, totalTokens: 2_200_000, sessions: 5, records: 5, tokens: tokens(700_000, 1_400_000, 100_000), savings: 0, priced: true },
  ];
  const projects = [
    ["T3 Code", "/Users/luis/GitHub/t3code", 47.92, 18_420_000, 23, ["codex", "claude"]],
    ["AI-Coding Stats", "/Users/luis/GitHub/AI-Coding Stats", 31.48, 12_820_000, 17, ["codex"]],
    ["typeset", "/Users/luis/GitHub/typeset", 22.13, 9_430_000, 14, ["claude", "codex"]],
    ["turbo-fieldfare", "/Users/luis/GitHub/turbo-fieldfare", 16.87, 8_280_000, 11, ["claude"]],
    ["Personal site", "/Users/luis/GitHub/personal-site", 8.04, 3_810_000, 8, ["opencode", "codex"]],
  ].map(([name, path, cost, total, sessions, providerList], index) => ({
    name: name as string,
    path: path as string,
    cost: cost as number,
    tokens: total as number,
    sessions: sessions as number,
    providers: providerList as Provider[],
    lastActive: now - index * DAY,
  }));
  const sessions = Array.from({ length: 18 }, (_, index) => {
    const provider = providers[index % providers.length] ?? "codex";
    const model = provider === "claude" ? "claude-opus-5" : provider === "opencode" ? "openai/gpt-5.5" : index % 3 ? "gpt-5.6-sol" : "gpt-5.5";
    const sessionTokens = tokens(82_000 + index * 4_300, 420_000 + index * 17_000, 12_000 + index * 970, 4_000);
    const end = now - index * 6.4 * 3_600_000;
    return {
      id: `demo-${index}`,
      provider,
      model,
      models: [model],
      project: projects[index % projects.length]?.name ?? "AI-Coding Stats",
      path: projects[index % projects.length]?.path ?? "",
      startedAt: end - (18 + index * 3) * 60_000,
      endedAt: end,
      cost: 1.2 + ((index * 23) % 19) * 0.21,
      savings: 2.7 + index * 0.18,
      tokens: sessionTokens,
      totalTokens: Object.values(sessionTokens).reduce((sum, value) => sum + value, 0) - sessionTokens.reasoning,
      records: 4 + (index % 9),
      priced: true,
    };
  });

  const cost = daily.reduce((sum, day) => sum + day.cost, 0);
  return {
    generatedAt: now,
    range,
    since: now - days * DAY,
    summary: {
      cost,
      tokens: summaryTokens,
      totalTokens: 68_056_200,
      sessions: 98,
      cacheHitRate: 0.858,
      savings: 230.5,
      pricedPercent: 1,
      projectedMonthly: cost * (30 / days),
      activeDays: Math.round(days * 0.72),
    },
    daily,
    models,
    providers: [
      { provider: "codex", cost: cost * 0.51, tokens: 39_500_000, sessions: 55, savings: 128.4 },
      { provider: "claude", cost: cost * 0.43, tokens: 26_100_000, sessions: 38, savings: 102.1 },
      { provider: "opencode", cost: cost * 0.06, tokens: 2_456_200, sessions: 5, savings: 0 },
    ],
    projects,
    sessions,
    sources: providers.map((provider, index) => ({
      provider,
      label: provider === "codex" ? "Codex" : provider === "claude" ? "Claude Code" : "OpenCode",
      path: provider === "codex" ? "~/.codex/sessions" : provider === "claude" ? "~/.claude/projects" : "~/.local/share/opencode/opencode.db",
      state: "connected",
      files: index === 0 ? 124 : index === 1 ? 144 : 1,
      records: index === 0 ? 614 : index === 1 ? 392 : 18,
      detail: index < 2 ? `${index === 0 ? 124 : 144} local transcripts` : "18 metered sessions",
    })),
    subscriptions: [
      {
        provider: "codex",
        state: "live",
        plan: "team",
        updatedAt: now - 90_000,
        windows: [
          { label: "Session limit", usedPercent: 34, windowMinutes: 300, resetsAt: now + 3.2 * 3_600_000 },
          { label: "Weekly limit", usedPercent: 61, windowMinutes: 10_080, resetsAt: now + 3.4 * DAY },
        ],
        detail: "Read from the latest local Codex rate-limit event.",
      },
      {
        provider: "claude",
        state: "live",
        plan: null,
        updatedAt: now - 45_000,
        windows: [
          { label: "5-hour limit", usedPercent: 24, windowMinutes: 300, resetsAt: now + 2.1 * 3_600_000 },
          { label: "Weekly limit", usedPercent: 41, windowMinutes: 10_080, resetsAt: now + 4.7 * DAY },
        ],
        detail: "Captured locally through Claude Code’s official status line.",
        capture: { kind: "claude-statusline", state: "active" },
      },
    ],
    warnings: [],
  };
}

export const EMPTY_DEMO_TOKENS = EMPTY_TOKENS;
