export type Provider = "codex" | "claude" | "opencode";
export type RangeKey = "7d" | "30d" | "90d" | "all";

export interface TokenTotals {
  readonly uncachedInput: number;
  readonly cachedInput: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
  readonly output: number;
  readonly reasoning: number;
}

export interface UsageRecord {
  readonly provider: Provider;
  readonly timestamp: number;
  readonly model: string;
  readonly sessionId: string;
  readonly workspace: string;
  readonly tokens: TokenTotals;
  readonly reportedCost: number | null;
  readonly dedupeKey: string | null;
}

export interface DailyPoint {
  readonly date: string;
  readonly cost: number;
  readonly tokens: number;
  readonly sessions: number;
  readonly byProvider: Record<Provider, number>;
}

export interface ModelStat {
  readonly model: string;
  readonly provider: Provider;
  readonly tokens: TokenTotals;
  readonly totalTokens: number;
  readonly cost: number;
  readonly savings: number;
  readonly sessions: number;
  readonly records: number;
  readonly priced: boolean;
}

export interface ProviderStat {
  readonly provider: Provider;
  readonly cost: number;
  readonly tokens: number;
  readonly sessions: number;
  readonly savings: number;
}

export interface ProjectStat {
  readonly name: string;
  readonly path: string;
  readonly cost: number;
  readonly tokens: number;
  readonly sessions: number;
  readonly providers: Provider[];
  readonly lastActive: number;
}

export interface SessionStat {
  readonly id: string;
  readonly provider: Provider;
  readonly model: string;
  readonly models: string[];
  readonly project: string;
  readonly path: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly cost: number;
  readonly savings: number;
  readonly tokens: TokenTotals;
  readonly totalTokens: number;
  readonly records: number;
  readonly priced: boolean;
}

export interface SourceStatus {
  readonly provider: Provider;
  readonly label: string;
  readonly path: string;
  readonly state: "connected" | "missing" | "error";
  readonly files: number;
  readonly records: number;
  readonly detail: string;
}

export interface SubscriptionWindow {
  readonly label: string;
  readonly usedPercent: number;
  readonly windowMinutes: number;
  readonly resetsAt: number;
}

export interface SubscriptionUsage {
  readonly provider: "codex" | "claude";
  readonly state: "live" | "unavailable";
  readonly plan: string | null;
  readonly updatedAt: number | null;
  readonly windows: SubscriptionWindow[];
  readonly detail: string;
  readonly capture?: {
    readonly kind: "claude-statusline";
    readonly state: "not-configured" | "waiting" | "active";
  };
}

export interface StatsSummary {
  readonly cost: number;
  readonly tokens: TokenTotals;
  readonly totalTokens: number;
  readonly sessions: number;
  readonly cacheHitRate: number;
  readonly savings: number;
  readonly pricedPercent: number;
  readonly projectedMonthly: number;
  readonly activeDays: number;
}

export interface StatsSnapshot {
  readonly generatedAt: number;
  readonly range: RangeKey;
  readonly since: number | null;
  readonly summary: StatsSummary;
  readonly daily: DailyPoint[];
  readonly models: ModelStat[];
  readonly providers: ProviderStat[];
  readonly projects: ProjectStat[];
  readonly sessions: SessionStat[];
  readonly sources: SourceStatus[];
  readonly subscriptions: SubscriptionUsage[];
  readonly warnings: string[];
}

export interface GitHubCommitEntry {
  readonly sha: string;
  readonly message: string;
  readonly at: number;
  readonly url: string;
}

export interface GitHubRepoDayActivity {
  readonly repo: string;
  readonly commits: GitHubCommitEntry[];
}

export interface GitHubPullRequestEntry {
  readonly number: number;
  readonly title: string;
  readonly repo: string;
  readonly at: number;
  readonly url: string;
  readonly merged: boolean;
}

export interface GitHubDay {
  readonly date: string;
  readonly commits: number;
  readonly repos: GitHubRepoDayActivity[];
  readonly pullRequests: GitHubPullRequestEntry[];
}

export interface GitHubRepoMonthActivity {
  readonly repo: string;
  readonly commits: number;
  readonly activeDays: number;
  readonly lastAt: number | null;
}

export interface GitHubMonthTotals {
  readonly commits: number;
  readonly activeDays: number;
  readonly repos: number;
  readonly pullRequests: number;
}

export interface GitHubMonthSnapshot {
  readonly month: string;
  readonly login: string;
  readonly state: "ok" | "setup";
  readonly detail: string;
  readonly fetchedAt: number;
  readonly days: GitHubDay[];
  readonly repos: GitHubRepoMonthActivity[];
  readonly totals: GitHubMonthTotals;
  readonly setup?: {
    readonly reason: "missing-cli" | "needs-auth";
    readonly command: string;
    readonly helpUrl: string;
  };
}

export type SystemToolId = "github" | "git" | Provider;

export interface SystemCheck {
  readonly id: SystemToolId;
  readonly label: string;
  readonly command: string;
  readonly state: "ready" | "action" | "missing";
  readonly version: string | null;
  readonly detail: string;
  readonly helpUrl: string;
}

export interface SystemCheckSnapshot {
  readonly checkedAt: number;
  readonly checks: SystemCheck[];
}

export interface TokenaryBridge {
  scan: (range: RangeKey) => Promise<StatsSnapshot>;
  subscriptions: () => Promise<SubscriptionUsage[]>;
  setupClaudeStatusLine: () => Promise<SubscriptionUsage>;
  systemChecks: () => Promise<SystemCheckSnapshot>;
  github: (month: string, refresh?: boolean) => Promise<GitHubMonthSnapshot>;
  openPath: (path: string) => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  platform: string;
}
