import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCopy,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  Database,
  FolderCode,
  FolderGit2,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  HardDrive,
  Info,
  Layers3,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  TerminalSquare,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GitHubCommitEntry,
  GitHubDay,
  GitHubMonthSnapshot,
  GitHubPullRequestEntry,
  ModelStat,
  ProjectStat,
  Provider,
  RangeKey,
  SessionStat,
  StatsSnapshot,
  SubscriptionUsage,
  SystemCheck,
  SystemCheckSnapshot,
} from "../../shared/types";
import { buildDaySummary, buildInvoiceSummary, currentMonthKey, dayLabel, isDayActive, monthLabel, shiftMonthKey } from "../../shared/invoice";
import { UsageChart } from "./components/UsageChart";
import { ProviderMark } from "./components/ProviderMark";
import { demoGithub } from "./githubDemo";
import { demoSnapshot } from "./demo";
import {
  PROVIDERS,
  cacheRate,
  compact,
  dateTime,
  duration,
  modelName,
  money,
  percent,
  relative,
} from "./format";

type Page = "overview" | "plans" | "models" | "projects" | "sessions" | "github" | "sources";
type Theme = "dark" | "light";

const IS_ELECTRON = navigator.userAgent.includes("Electron");

function missingBridgeError(): Error {
  return new Error("Tokenary could not start its local data bridge. Quit and reopen the app; if this continues, reinstall the latest build.");
}

const NAVIGATION: { id: Page; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "plans", label: "Plans", icon: CreditCard },
  { id: "models", label: "Models", icon: Boxes },
  { id: "projects", label: "Projects", icon: FolderCode },
  { id: "sessions", label: "Sessions", icon: TerminalSquare },
  { id: "github", label: "Contributions", icon: GitBranch },
];

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-title-row">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

function ProviderDots({ providers }: { providers: Provider[] }) {
  return (
    <span className="provider-dots" aria-label={providers.map((provider) => PROVIDERS[provider].label).join(", ")}>
      {providers.map((provider) => (
        <span key={provider} style={{ background: PROVIDERS[provider].color }} />
      ))}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <motion.div className={`kpi panel${accent ? " kpi--accent" : ""}`} layout>
      <div className="kpi-icon"><Icon size={15} /></div>
      <div className="kpi-label">{label}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </motion.div>
  );
}

function ModelRow({ model, maxCost }: { model: ModelStat; maxCost: number }) {
  return (
    <div className="data-row model-row">
      <div className="identity-cell">
        <ProviderMark provider={model.provider} />
        <div>
          <strong>{modelName(model.model)}</strong>
          <span>{PROVIDERS[model.provider].label}</span>
        </div>
      </div>
      <div className="bar-cell">
        <span className="mini-bar"><i style={{ width: `${Math.max(2, (model.cost / Math.max(0.01, maxCost)) * 100)}%` }} /></span>
        <span>{percent(cacheRate(model.tokens))} cached</span>
      </div>
      <div className="numeric-cell"><strong>{money(model.cost)}</strong><span>est. spend</span></div>
      <div className="numeric-cell"><strong>{compact(model.totalTokens)}</strong><span>tokens</span></div>
      <div className="numeric-cell"><strong>{model.sessions}</strong><span>sessions</span></div>
    </div>
  );
}

function ProjectRow({ project, maxCost }: { project: ProjectStat; maxCost: number }) {
  return (
    <button
      className="data-row project-row"
      onClick={() => void window.tokenary?.openPath(project.path)}
      disabled={!project.path || !window.tokenary}
      title={project.path || "No workspace path recorded"}
    >
      <div className="project-rank-icon"><FolderCode size={16} /></div>
      <div className="project-name"><strong>{project.name}</strong><span>{project.path || "Unassigned workspace"}</span></div>
      <div className="project-spend-bar"><i style={{ width: `${Math.max(3, (project.cost / Math.max(0.01, maxCost)) * 100)}%` }} /></div>
      <ProviderDots providers={project.providers} />
      <div className="numeric-cell"><strong>{money(project.cost)}</strong><span>{compact(project.tokens)} tokens</span></div>
      <ChevronRight className="row-chevron" size={15} />
    </button>
  );
}

function SessionRow({ session }: { session: SessionStat }) {
  return (
    <div className="session-row">
      <ProviderMark provider={session.provider} />
      <div className="session-project">
        <strong>{session.project}</strong>
        <span>{modelName(session.model)}</span>
      </div>
      <div className="session-time"><strong>{relative(session.endedAt)}</strong><span>{duration(session.startedAt, session.endedAt)}</span></div>
      <div className="session-tokens"><strong>{compact(session.totalTokens)}</strong><span>{session.records} turns</span></div>
      <div className="session-cost"><strong>{money(session.cost)}</strong><span>{session.priced ? "API equiv." : "partial"}</span></div>
    </div>
  );
}

function ProviderBreakdown({ snapshot }: { snapshot: StatsSnapshot }) {
  const max = Math.max(0.01, snapshot.summary.cost);
  return (
    <div className="panel provider-panel">
      <CardTitle action={<span className="muted-label">share</span>}>Providers</CardTitle>
      <div className="provider-stack" aria-label="Provider cost distribution">
        {snapshot.providers.map((provider) => (
          <i
            key={provider.provider}
            style={{ width: `${(provider.cost / max) * 100}%`, background: PROVIDERS[provider.provider].color }}
          />
        ))}
      </div>
      <div className="provider-list">
        {snapshot.providers.map((provider) => (
          <div className="provider-item" key={provider.provider}>
            <ProviderMark provider={provider.provider} />
            <div><strong>{PROVIDERS[provider.provider].label}</strong><span>{provider.sessions} sessions · {compact(provider.tokens)} tokens</span></div>
            <div className="provider-value"><strong>{money(provider.cost)}</strong><span>{percent(provider.cost / max)}</span></div>
          </div>
        ))}
      </div>
      <div className="provider-footnote"><Sparkles size={13} /><span>Caching avoided an estimated <strong>{money(snapshot.summary.savings)}</strong> in input processing.</span></div>
    </div>
  );
}

function ActivityCalendar({ snapshot }: { snapshot: StatsSnapshot }) {
  const data = snapshot.daily.slice(-84);
  const peak = Math.max(0.01, ...data.map((day) => day.cost));
  return (
    <div className="calendar-card panel">
      <CardTitle action={<span className="muted-label">last {data.length} days</span>}>Coding rhythm</CardTitle>
      <div className="activity-grid">
        {data.map((day) => (
          <span
            key={day.date}
            title={`${day.date}: ${money(day.cost)} · ${day.sessions} sessions`}
            style={{ "--heat": Math.max(0.05, day.cost / peak) } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="calendar-footer"><span>{snapshot.summary.activeDays} active days</span><span>Less <i /><i /><i /><i /> More</span></div>
    </div>
  );
}

function Overview({ snapshot, navigate }: { snapshot: StatsSnapshot; navigate: (page: Page) => void }) {
  const maxModel = snapshot.models[0]?.cost ?? 1;
  const maxProject = snapshot.projects[0]?.cost ?? 1;
  const inputTokens =
    snapshot.summary.tokens.uncachedInput +
    snapshot.summary.tokens.cachedInput +
    snapshot.summary.tokens.cacheWrite5m +
    snapshot.summary.tokens.cacheWrite1h;
  return (
    <>
      <section className="overview-hero">
        <div className="hero panel">
          <div className="hero-heading">
            <div>
              <span className="eyebrow"><CircleDollarSign size={13} /> API-equivalent spend</span>
              <div className="hero-value">{money(snapshot.summary.cost)}</div>
              <p>{snapshot.summary.sessions} local sessions · {RANGE_LABELS[snapshot.range].toLowerCase()}</p>
            </div>
            <div className="projection-pill">
              <span>30-day pace</span>
              <strong>{money(snapshot.summary.projectedMonthly)}</strong>
            </div>
          </div>
          <UsageChart data={snapshot.daily} />
        </div>
        <ProviderBreakdown snapshot={snapshot} />
      </section>

      <section className="kpi-grid">
        <Kpi icon={Layers3} label="Processed tokens" value={compact(snapshot.summary.totalTokens)} detail={`${compact(inputTokens)} input · ${compact(snapshot.summary.tokens.output)} output`} />
        <Kpi icon={Database} label="Cache hit rate" value={percent(snapshot.summary.cacheHitRate)} detail={`${compact(snapshot.summary.tokens.cachedInput)} tokens reused`} accent />
        <Kpi icon={WalletCards} label="Cache savings" value={money(snapshot.summary.savings)} detail="Compared with uncached input" />
        <Kpi icon={Clock3} label="Average session" value={money(snapshot.summary.cost / Math.max(1, snapshot.summary.sessions))} detail={`${compact(snapshot.summary.totalTokens / Math.max(1, snapshot.summary.sessions))} tokens each`} />
      </section>

      <section className="split-panels">
        <div className="panel list-panel">
          <CardTitle action={<button className="text-action" onClick={() => navigate("models")}>View all <ChevronRight size={13} /></button>}>Models</CardTitle>
          <div className="table-header model-row"><span>Model</span><span>Cache efficiency</span><span>Spend</span><span>Tokens</span><span>Runs</span></div>
          {snapshot.models.slice(0, 5).map((model) => <ModelRow key={`${model.provider}:${model.model}`} model={model} maxCost={maxModel} />)}
          {snapshot.models.length === 0 ? <EmptyState compactMode label="No model usage in this range" /> : null}
        </div>
        <ActivityCalendar snapshot={snapshot} />
      </section>

      <section className="panel list-panel project-panel">
        <CardTitle action={<button className="text-action" onClick={() => navigate("projects")}>View all <ChevronRight size={13} /></button>}>Most active projects</CardTitle>
        {snapshot.projects.slice(0, 5).map((project) => <ProjectRow key={project.path || project.name} project={project} maxCost={maxProject} />)}
        {snapshot.projects.length === 0 ? <EmptyState compactMode label="No workspace activity in this range" /> : null}
      </section>
    </>
  );
}

function ModelsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const maxCost = snapshot.models[0]?.cost ?? 1;
  return (
    <div className="page-stack">
      <section className="model-feature-grid">
        {snapshot.models.slice(0, 3).map((model, index) => (
          <div className="panel model-feature" key={`${model.provider}:${model.model}`}>
            <div className="rank">0{index + 1}</div>
            <ProviderMark provider={model.provider} />
            <div className="model-feature-name"><span>{PROVIDERS[model.provider].label}</span><strong>{modelName(model.model)}</strong></div>
            <div className="model-feature-cost"><strong>{money(model.cost)}</strong><span>{compact(model.totalTokens)} tokens</span></div>
            <div className="feature-progress"><i style={{ width: `${(model.cost / maxCost) * 100}%` }} /></div>
            <div className="feature-meta"><span>{model.sessions} sessions</span><span>{percent(cacheRate(model.tokens))} cached</span><span>{money(model.savings)} saved</span></div>
          </div>
        ))}
      </section>
      <section className="panel list-panel">
        <CardTitle action={<span className="muted-label">{snapshot.models.length} detected</span>}>Complete model ledger</CardTitle>
        <div className="table-header model-row"><span>Model</span><span>Cache efficiency</span><span>Spend</span><span>Tokens</span><span>Runs</span></div>
        {snapshot.models.map((model) => <ModelRow key={`${model.provider}:${model.model}`} model={model} maxCost={maxCost} />)}
      </section>
    </div>
  );
}

function ProjectsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const maxCost = snapshot.projects[0]?.cost ?? 1;
  return (
    <div className="page-stack">
      <section className="project-summary panel">
        <div><span className="eyebrow"><FolderCode size={13} /> Workspaces detected</span><strong>{snapshot.projects.length}</strong><p>Local paths stay on this Mac.</p></div>
        <div className="project-summary-stat"><span>Most active</span><strong>{snapshot.projects[0]?.name ?? "—"}</strong><small>{snapshot.projects[0] ? money(snapshot.projects[0].cost) : "$0.00"}</small></div>
        <div className="project-summary-stat"><span>Average / project</span><strong>{money(snapshot.summary.cost / Math.max(1, snapshot.projects.length))}</strong><small>API equivalent</small></div>
      </section>
      <section className="panel list-panel project-panel">
        <CardTitle action={<span className="muted-label">click a row to open</span>}>Project ledger</CardTitle>
        {snapshot.projects.map((project) => <ProjectRow key={project.path || project.name} project={project} maxCost={maxCost} />)}
      </section>
    </div>
  );
}

function SessionsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const [query, setQuery] = useState("");
  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return snapshot.sessions;
    return snapshot.sessions.filter((session) =>
      `${session.project} ${session.model} ${session.provider}`.toLowerCase().includes(normalized),
    );
  }, [query, snapshot.sessions]);
  return (
    <div className="page-stack">
      <section className="session-toolbar panel">
        <div className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project or model…" /></div>
        <span>{sessions.length} of {snapshot.sessions.length} sessions</span>
      </section>
      <section className="panel sessions-panel">
        <div className="session-header"><span>Session</span><span>When</span><span>Usage</span><span>Equivalent</span></div>
        {sessions.map((session) => <SessionRow key={session.id} session={session} />)}
        {sessions.length === 0 ? <EmptyState label="No matching sessions" /> : null}
      </section>
    </div>
  );
}

function CommitLine({ commit }: { commit: GitHubCommitEntry }) {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(commit.at);
  return (
    <button className="gh-commit" onClick={() => void window.tokenary?.openUrl(commit.url)} title="Open commit on GitHub">
      <span className="gh-commit-time">{time}</span>
      <strong>{commit.message}</strong>
      <ArrowUpRight size={12} />
    </button>
  );
}

function PullRequestLine({ pullRequest }: { pullRequest: GitHubPullRequestEntry }) {
  return (
    <button className="gh-commit gh-commit--pr" onClick={() => void window.tokenary?.openUrl(pullRequest.url)} title="Open pull request on GitHub">
      <span className="gh-commit-time">#{pullRequest.number}</span>
      <strong>{pullRequest.title}</strong>
      <span className={`gh-pr-badge${pullRequest.merged ? " gh-pr-badge--merged" : ""}`}>{pullRequest.merged ? "merged" : "open"}</span>
    </button>
  );
}

function DayCard({ day, ai, copied, onCopy }: {
  day: GitHubDay;
  ai: Map<string, { sessions: number; cost: number }>;
  copied: boolean;
  onCopy: (day: GitHubDay) => void;
}) {
  const aiPoint = ai.get(day.date);
  return (
    <div className="panel gh-day" id={`gh-day-${day.date}`}>
      <div className="gh-day-head">
        <div className="gh-day-title"><strong>{dayLabel(day.date)}</strong><span>{day.commits} commits · {day.repos.length} {day.repos.length === 1 ? "project" : "projects"}</span></div>
        {aiPoint ? (
          <span className="gh-ai-chip" title="Local AI coding activity measured on this Mac">
            <Sparkles size={11} />{aiPoint.sessions} AI sessions · {money(aiPoint.cost)}
          </span>
        ) : null}
        <button className="text-action gh-copy" onClick={() => onCopy(day)}>{copied ? <><Copy size={12} /> Copied</> : <><ClipboardCopy size={12} /> Copy</>}</button>
      </div>
      <div className="gh-day-body">
        {day.repos.map((group) => (
          <div className="gh-repo-group" key={group.repo}>
            <div className="gh-repo-name"><GitBranch size={12} /><span>{group.repo}</span><small>{group.commits.length}</small></div>
            {group.commits.map((commit) => <CommitLine key={commit.sha} commit={commit} />)}
          </div>
        ))}
        {day.pullRequests.length > 0 ? (
          <div className="gh-repo-group">
            <div className="gh-repo-name"><GitPullRequest size={12} /><span>Pull requests</span><small>{day.pullRequests.length}</small></div>
            {day.pullRequests.map((pullRequest) => <PullRequestLine key={pullRequest.number} pullRequest={pullRequest} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MonthHeatGrid({ data }: { data: GitHubMonthSnapshot }) {
  const peak = Math.max(1, ...data.days.map((day) => day.commits));
  const year = Number(data.month.slice(0, 4));
  const monthIndex = Number(data.month.slice(5, 7)) - 1;
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isCurrentMonth = data.month === currentMonthKey(today);
  return (
    <div className="panel gh-heat-panel">
      <CardTitle action={<span className="muted-label">{data.totals.activeDays} active days</span>}>Monthly rhythm</CardTitle>
      <div className="gh-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <span key={index}>{label}</span>)}</div>
      <div className="gh-heat-grid">
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`pad-${index}`} />)}
        {data.days.map((day) => {
          const future = isCurrentMonth && day.date > todayKey;
          return (
            <button
              key={day.date}
              className={`gh-heat-cell${day.date === todayKey ? " gh-heat-today" : ""}${future ? " gh-heat-future" : ""}`}
              title={future ? day.date : `${day.date}: ${day.commits} commits`}
              style={{ "--heat": Math.max(0.06, day.commits / peak) } as React.CSSProperties}
              onClick={() => document.getElementById(`gh-day-${day.date}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
          );
        })}
      </div>
      <div className="calendar-footer"><span>Click a day to jump to it</span><span>Less <i /><i /><i /><i /> More</span></div>
    </div>
  );
}

function RepoTotals({ data }: { data: GitHubMonthSnapshot }) {
  const max = Math.max(1, data.repos[0]?.commits ?? 1);
  return (
    <div className="panel gh-repos-panel">
      <CardTitle action={<span className="muted-label">{data.totals.repos} projects</span>}>By project</CardTitle>
      <div className="gh-repo-list">
        {data.repos.map((repo) => (
          <button key={repo.repo} className="gh-repo-row" onClick={() => void window.tokenary?.openUrl(`https://github.com/${repo.repo}`)} title={`Open ${repo.repo} on GitHub`}>
            <div className="gh-repo-row-name"><strong>{repo.repo.split("/")[1] ?? repo.repo}</strong><span>{repo.repo}</span></div>
            <span className="mini-bar"><i style={{ width: `${Math.max(4, (repo.commits / max) * 100)}%` }} /></span>
            <div className="numeric-cell"><strong>{repo.commits}</strong><span>{repo.activeDays}d active</span></div>
          </button>
        ))}
        {data.repos.length === 0 ? <EmptyState compactMode label="No project activity this month" /> : null}
      </div>
    </div>
  );
}

function GitHubPage({ snapshot }: { snapshot: StatsSnapshot | null }) {
  const currentMonth = currentMonthKey();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<GitHubMonthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedDay, setCopiedDay] = useState<string | null>(null);
  const [copiedMonth, setCopiedMonth] = useState(false);

  const load = useCallback(async (target: string, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.tokenary && IS_ELECTRON) throw missingBridgeError();
      const next = window.tokenary ? await window.tokenary.github(target, refresh) : demoGithub(target);
      setData(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "GitHub activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const view = data && data.month === month ? data : null;

  const ai = useMemo(() => {
    const map = new Map<string, { sessions: number; cost: number }>();
    for (const point of snapshot?.daily ?? []) map.set(point.date, { sessions: point.sessions, cost: point.cost });
    return map;
  }, [snapshot]);

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    if (key === "month") {
      setCopiedMonth(true);
      window.setTimeout(() => setCopiedMonth(false), 1800);
    } else {
      setCopiedDay(key);
      window.setTimeout(() => setCopiedDay(null), 1800);
    }
  }, []);

  const copyDay = useCallback((day: GitHubDay) => void copyText(buildDaySummary(day), day.date), [copyText]);
  const copyMonth = useCallback(() => {
    if (view && view.state === "ok") void copyText(buildInvoiceSummary(view), "month");
  }, [copyText, view]);

  const activeDays = view?.days.filter(isDayActive) ?? [];
  const hasActivity = view ? view.totals.commits > 0 || view.totals.pullRequests > 0 : false;

  return (
    <div className="page-stack">
      <section className="panel gh-toolbar">
        <div className="month-nav">
          <button className="icon-button" onClick={() => setMonth(shiftMonthKey(month, -1))} title="Previous month"><ChevronLeft size={14} /></button>
          <strong>{monthLabel(month)}</strong>
          <button className="icon-button" disabled={month >= currentMonth} onClick={() => setMonth(shiftMonthKey(month, 1))} title="Next month"><ChevronRight size={14} /></button>
        </div>
        <div className="gh-toolbar-actions">
          {view && view.state === "ok" ? <span className="muted-label">fetched {relative(view.fetchedAt)} ago · @{view.login}</span> : null}
          <button className="icon-button" onClick={() => void load(month, true)} disabled={loading} title="Refresh from GitHub"><RefreshCw size={14} className={loading ? "spin" : ""} /></button>
          <button className="copy-summary" onClick={copyMonth} disabled={!hasActivity}>
            <ClipboardCopy size={13} />{copiedMonth ? "Copied — paste it into your invoice" : "Copy invoice summary"}
          </button>
        </div>
      </section>

      {error ? <div className="warning-banner"><Info size={15} /><span>{error}</span><button onClick={() => void load(month, true)}>Try again</button></div> : null}

      {view?.detail ? <div className="warning-banner warning-banner--soft"><Info size={15} /><span>{view.detail}</span></div> : null}

      {loading && !view ? (
        <div className="panel gh-loading">
          <div className="loading-mark"><GitBranch size={20} /></div>
          <strong>Fetching your GitHub month</strong>
          <span>Listing repositories, commits, and pull requests…</span>
          <div className="loading-bar"><i /></div>
        </div>
      ) : null}

      {view && view.state === "setup" ? (
        <div className="panel gh-setup">
          <GitBranch size={22} />
          <strong>{view.setup?.reason === "missing-cli" ? "Install GitHub CLI" : "Connect your GitHub account"}</strong>
          <p>{view.detail}</p>
          <code>{view.setup?.command ?? "gh auth login"}</code>
          <div className="gh-setup-actions">
            {view.setup ? <button className="text-action" onClick={() => void window.tokenary?.openUrl(view.setup!.helpUrl)}><ArrowUpRight size={12} /> Open setup guide</button> : null}
            <button className="copy-summary" onClick={() => void load(month, true)}><RefreshCw size={13} /> Check again</button>
          </div>
        </div>
      ) : null}

      {view && view.state === "ok" ? (
        <>
          <section className="kpi-grid">
            <Kpi icon={GitCommitHorizontal} label="Commits" value={String(view.totals.commits)} detail={`${monthLabel(month)} · @${view.login}`} />
            <Kpi icon={CalendarDays} label="Active days" value={String(view.totals.activeDays)} detail="Days with commits or pull requests" accent />
            <Kpi icon={GitPullRequest} label="Pull requests" value={String(view.totals.pullRequests)} detail="Opened during this month" />
            <Kpi icon={FolderGit2} label="Projects" value={String(view.totals.repos)} detail="Repositories with your commits" />
          </section>
          <section className="split-panels">
            <div className="gh-days">
              {activeDays.map((day) => <DayCard key={day.date} day={day} ai={ai} copied={copiedDay === day.date} onCopy={copyDay} />)}
              {activeDays.length === 0 ? <div className="panel"><EmptyState label="No GitHub activity recorded this month" /></div> : null}
            </div>
            <div className="gh-side">
              <MonthHeatGrid data={view} />
              <RepoTotals data={view} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function resetText(timestamp: number): string {
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return "Reset due";
  const totalMinutes = Math.ceil(remaining / 60_000);
  if (totalMinutes < 60) return `Resets in ${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `Resets in ${hours}h${minutes ? ` ${minutes}m` : ""}`;
  const days = Math.floor(hours / 24);
  return `Resets in ${days}d ${hours % 24}h`;
}

function SubscriptionCard({
  usage,
  snapshot,
  connectingClaude,
  onConnectClaude,
}: {
  usage: SubscriptionUsage;
  snapshot: StatsSnapshot;
  connectingClaude: boolean;
  onConnectClaude: () => void;
}) {
  const activity = snapshot.providers.find((provider) => provider.provider === usage.provider);
  const isLive = usage.state === "live" && usage.windows.length > 0;
  return (
    <section className={`panel subscription-card${isLive ? "" : " subscription-card--unavailable"}`}>
      <div className="subscription-header">
        <div className="subscription-identity">
          <ProviderMark provider={usage.provider} />
          <div><strong>{PROVIDERS[usage.provider].label}</strong><span>{usage.plan ? `${usage.plan} plan` : "Subscription"}</span></div>
        </div>
        <span className={`subscription-state subscription-state--${isLive ? "live" : "unavailable"}`}>
          <i />{isLive ? "Live allowance" : "Activity only"}
        </span>
      </div>

      {isLive ? (
        <div className="allowance-list">
          {usage.windows.map((window) => (
            <div className="allowance" key={`${window.label}:${window.windowMinutes}`}>
              <div className="allowance-heading"><span>{window.label}</span><strong>{Math.round(window.usedPercent)}% <small>used</small></strong></div>
              <div className="allowance-track"><i style={{ width: `${window.usedPercent}%` }} /></div>
              <div className="allowance-meta"><span>{Math.round(100 - window.usedPercent)}% available</span><span>{resetText(window.resetsAt)}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="allowance-empty">
          <CreditCard size={21} />
          <strong>{usage.capture?.state === "waiting" ? "Waiting for Claude Code" : "Allowance not connected"}</strong>
          <p>{usage.detail}</p>
          {usage.capture?.state === "not-configured" ? (
            <button className="connect-button" onClick={onConnectClaude} disabled={connectingClaude}>
              {connectingClaude ? <><RefreshCw className="spin" size={12} /> Connecting…</> : "Connect Claude Code"}
            </button>
          ) : null}
        </div>
      )}

      <div className="subscription-activity">
        <div><span>Local activity</span><strong>{compact(activity?.tokens ?? 0)}</strong><small>tokens · {RANGE_LABELS[snapshot.range].toLowerCase()}</small></div>
        <div><span>Sessions</span><strong>{activity?.sessions ?? 0}</strong><small>measured locally</small></div>
        <div><span>API equivalent</span><strong>{money(activity?.cost ?? 0)}</strong><small>not your plan bill</small></div>
      </div>
      <div className="subscription-foot">
        <span>{usage.updatedAt ? `Captured ${relative(usage.updatedAt)} ago` : usage.capture?.state === "waiting" ? "Status line connected" : "Waiting for setup"}</span>
        {isLive ? <span>{usage.detail}</span> : null}
      </div>
    </section>
  );
}

function PlansPage({
  snapshot,
  connectingClaude,
  onConnectClaude,
}: {
  snapshot: StatsSnapshot;
  connectingClaude: boolean;
  onConnectClaude: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="panel plans-intro">
        <div><span className="eyebrow"><CreditCard size={13} /> Subscription monitor</span><h2>Your coding allowances, together.</h2><p>Quota percentages come from provider-reported limit events. Local activity stays separate, so estimated token cost is never confused with your subscription bill.</p></div>
        <div className="plans-live-count"><strong>{snapshot.subscriptions.filter((usage) => usage.state === "live").length}</strong><span>of {snapshot.subscriptions.length} live</span></div>
      </section>
      <div className="subscription-grid">
        {snapshot.subscriptions.map((usage) => (
          <SubscriptionCard
            key={usage.provider}
            usage={usage}
            snapshot={snapshot}
            connectingClaude={connectingClaude}
            onConnectClaude={onConnectClaude}
          />
        ))}
      </div>
      <div className="estimate-callout plans-note"><Info size={16} /><span>Codex refreshes from local limit events. Claude refreshes after responses through its official status-line integration; Tokenary stores only the two allowance windows on this Mac.</span></div>
    </div>
  );
}

function SystemCheckIcon({ check }: { check: SystemCheck }) {
  if (check.id === "codex" || check.id === "claude" || check.id === "opencode") {
    return <ProviderMark provider={check.id} />;
  }
  return <span className="system-check-icon">{check.id === "github" ? <GitBranch size={15} /> : <Code2 size={15} />}</span>;
}

function SourcesPage({ snapshot, theme, setTheme }: { snapshot: StatsSnapshot; theme: Theme; setTheme: (theme: Theme) => void }) {
  const [system, setSystem] = useState<SystemCheckSnapshot | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(false);

  const loadSystemChecks = useCallback(async () => {
    setCheckingSystem(true);
    try {
      if (window.tokenary) {
        setSystem(await window.tokenary.systemChecks());
      } else {
        setSystem({
          checkedAt: Date.now(),
          checks: [
            { id: "github", label: "GitHub access", command: "gh", state: "ready", version: "GitHub CLI", detail: "Ready for Contributions through GitHub CLI.", helpUrl: "https://cli.github.com/" },
            { id: "git", label: "Git", command: "git", state: "ready", version: "git version 2.50.1", detail: "Installed and available to Tokenary.", helpUrl: "https://git-scm.com/download/mac" },
            { id: "codex", label: "Codex", command: "codex", state: "ready", version: "codex-cli", detail: "Installed and available to Tokenary.", helpUrl: "https://learn.chatgpt.com/docs/codex/cli" },
            { id: "claude", label: "Claude Code", command: "claude", state: "missing", version: null, detail: "Install and use Claude Code to create local project metadata for Tokenary.", helpUrl: "https://docs.anthropic.com/en/docs/claude-code/getting-started" },
            { id: "opencode", label: "OpenCode", command: "opencode", state: "ready", version: "opencode", detail: "Installed and available to Tokenary.", helpUrl: "https://opencode.ai/docs/" },
          ],
        });
      }
    } finally {
      setCheckingSystem(false);
    }
  }, []);

  useEffect(() => {
    void loadSystemChecks();
  }, [loadSystemChecks]);

  return (
    <div className="settings-layout">
      <section className="panel settings-card">
        <div className="settings-section-head">
          <div><CardTitle>System check</CardTitle><p className="settings-intro">See what this Mac has installed and what still needs attention. Tokenary never installs command-line tools without you.</p></div>
          <button className="icon-button" onClick={() => void loadSystemChecks()} disabled={checkingSystem} title="Check again"><RefreshCw size={14} className={checkingSystem ? "spin" : ""} /></button>
        </div>
        <div className="system-check-list">
          {system?.checks.map((check) => (
            <div className="system-check-row" key={check.id}>
              <SystemCheckIcon check={check} />
              <div className="system-check-name"><strong>{check.label}</strong><span>{check.version ?? check.command}</span></div>
              <div className="system-check-detail"><span className={`status-dot system-dot--${check.state}`} /><strong>{check.state === "ready" ? "Ready" : check.state === "action" ? "Action needed" : check.id === "git" ? "Optional" : "Not found"}</strong><small>{check.detail}</small></div>
              <button className="text-action system-check-help" onClick={() => void window.tokenary?.openUrl(check.helpUrl)}>{check.state === "ready" ? "Docs" : check.state === "action" ? "Set up" : "Install"}<ArrowUpRight size={11} /></button>
            </div>
          )) ?? <div className="system-check-loading"><RefreshCw className="spin" size={13} /> Checking this Mac…</div>}
        </div>
        <div className="estimate-callout"><Info size={16} /><span>Contributions needs GitHub access, not the Git executable itself. Use an authenticated <strong>gh</strong> CLI or launch Tokenary with <strong>GH_TOKEN</strong>. Git is shown because it is useful for local development.</span></div>
      </section>
      <section className="panel settings-card">
        <CardTitle>Data sources</CardTitle>
        <p className="settings-intro">Tokenary reads usage metadata directly from the coding agents already installed on this Mac. Prompt text and tool output never enter the dashboard.</p>
        <div className="source-list">
          {snapshot.sources.map((source) => (
            <button className="source-row" key={source.provider} onClick={() => void window.tokenary?.openPath(source.path)} disabled={!window.tokenary}>
              <ProviderMark provider={source.provider} />
              <div><strong>{source.label}</strong><span>{source.path}</span></div>
              <div className="source-detail"><span className={`status-dot status-dot--${source.state}`} /> <strong>{source.state}</strong><small>{source.detail}</small></div>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
      <section className="panel settings-card">
        <CardTitle>Estimate method</CardTitle>
        <div className="method-grid">
          <div><div className="method-icon"><Database size={17} /></div><strong>Usage metadata</strong><p>Input, cache read/write, output, and reasoning counts come from local provider transcripts.</p></div>
          <div><div className="method-icon"><CircleDollarSign size={17} /></div><strong>List prices</strong><p>Known models use standard public API token prices. Provider-reported cost wins when present.</p></div>
          <div><div className="method-icon"><HardDrive size={17} /></div><strong>On-device</strong><p>No account link, API key, analytics endpoint, or cloud database is required.</p></div>
        </div>
        <div className="estimate-callout"><Info size={16} /><span>These are “what this would cost through the API” estimates. They are not your ChatGPT, Claude, or Cursor subscription bill.</span></div>
      </section>
      <section className="panel settings-card appearance-card">
        <div><CardTitle>Appearance</CardTitle><p className="settings-intro">Choose the dashboard theme for this Mac.</p></div>
        <div className="theme-toggle">
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={15} /> Dark</button>
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={15} /> Light</button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ label, compactMode = false }: { label: string; compactMode?: boolean }) {
  return <div className={`empty-state${compactMode ? " empty-state--compact" : ""}`}><BarChart3 size={20} /><span>{label}</span></div>;
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-mark"><Activity size={23} /></div>
      <strong>Reading local usage</strong>
      <span>Scanning Codex, Claude Code, and OpenCode metadata…</span>
      <div className="loading-bar"><i /></div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [range, setRange] = useState<RangeKey>("30d");
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingClaude, setConnectingClaude] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("tokenary:theme") === "light" ? "light" : "dark"));

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem("tokenary:theme", next);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const load = useCallback(async (nextRange: RangeKey) => {
    setRefreshing(true);
    setError(null);
    try {
      if (!window.tokenary && IS_ELECTRON) throw missingBridgeError();
      const next = window.tokenary ? await window.tokenary.scan(nextRange) : demoSnapshot(nextRange);
      setSnapshot(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local scan could not finish.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  useEffect(() => {
    if (!window.tokenary) return;
    const interval = window.setInterval(() => {
      void window.tokenary?.subscriptions().then((subscriptions) => {
        setSnapshot((current) => current ? { ...current, subscriptions } : current);
      }).catch(() => {
        // A transient read failure should not replace an otherwise valid dashboard.
      });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const connectClaude = useCallback(async () => {
    if (!window.tokenary) return;
    setConnectingClaude(true);
    setError(null);
    try {
      const claude = await window.tokenary.setupClaudeStatusLine();
      setSnapshot((current) => current ? {
        ...current,
        subscriptions: current.subscriptions.map((usage) => usage.provider === "claude" ? claude : usage),
      } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Claude Code could not be connected.");
    } finally {
      setConnectingClaude(false);
    }
  }, []);

  const pageTitle = NAVIGATION.find((item) => item.id === page)?.label ?? "Data Sources";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark"><Activity size={16} /></div>
          <div><strong>Tokenary</strong><span>AI coding telemetry</span></div>
        </div>
        <nav>
          <span className="nav-label">Workspace</span>
          {NAVIGATION.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon size={16} /><span>{label}</span>{id === "sessions" && snapshot ? <small>{snapshot.sessions.length}</small> : null}</button>
          ))}
          <span className="nav-label nav-label--second">System</span>
          <button className={page === "sources" ? "active" : ""} onClick={() => setPage("sources")}><Settings size={16} /><span>Data & settings</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="source-health">
          <span>Local sources</span>
          <div>
            {snapshot?.sources.map((source) => <i key={source.provider} title={`${source.label}: ${source.state}`} className={source.state} style={{ "--source": PROVIDERS[source.provider].color } as React.CSSProperties} />)}
          </div>
        </div>
        <div className="privacy-pill"><HardDrive size={13} /><span>On-device only</span></div>
      </aside>

      <main>
        <header className="topbar">
          <div className="breadcrumb"><Code2 size={15} /><span>Analytics</span><ChevronRight size={13} /><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <div className="range-control">
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => <button key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>{key === "all" ? "All" : key.toUpperCase()}</button>)}
            </div>
            <button className="icon-button" onClick={() => void load(range)} title="Refresh local data" disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /></button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content-container">
            <div className="page-heading">
              <div><span className="eyebrow"><Activity size={13} /> Local intelligence</span><h1>{pageTitle}</h1><p>{page === "overview" ? "A clear view of the compute behind your code." : page === "plans" ? "See subscription allowance and measured activity without switching apps." : page === "models" ? "See which models do the work—and what that work is worth." : page === "projects" ? "Understand where your AI development budget goes." : page === "sessions" ? "Every measured coding run, without the conversation content." : page === "github" ? "Day-by-day GitHub contributions, grouped by project—ready to paste into your next invoice." : "Control how Tokenary reads and presents local data."}</p></div>
              {snapshot ? <div className="last-scanned"><span className="status-dot status-dot--connected" /><div><strong>Live local data</strong><span>Updated {dateTime(snapshot.generatedAt)}</span></div></div> : null}
            </div>

            {error ? <div className="warning-banner"><Info size={15} /><span>{error}</span><button onClick={() => void load(range)}>Try again</button></div> : null}
            {snapshot?.warnings.map((warning) => <div className="warning-banner warning-banner--soft" key={warning}><Info size={15} /><span>{warning}</span></div>)}

            {!snapshot ? <LoadingScreen /> : (
              <AnimatePresence mode="wait">
                <motion.div className="page-content" key={page} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}>
                  {page === "overview" ? <Overview snapshot={snapshot} navigate={setPage} /> : null}
                  {page === "plans" ? <PlansPage snapshot={snapshot} connectingClaude={connectingClaude} onConnectClaude={() => void connectClaude()} /> : null}
                  {page === "models" ? <ModelsPage snapshot={snapshot} /> : null}
                  {page === "projects" ? <ProjectsPage snapshot={snapshot} /> : null}
                  {page === "sessions" ? <SessionsPage snapshot={snapshot} /> : null}
                  {page === "github" ? <GitHubPage snapshot={snapshot} /> : null}
                  {page === "sources" ? <SourcesPage snapshot={snapshot} theme={theme} setTheme={setTheme} /> : null}
                </motion.div>
              </AnimatePresence>
            )}
            <footer><span>Tokenary {__APP_VERSION__}</span><span>API-equivalent estimates · no prompts are read</span></footer>
          </div>
        </div>
      </main>
    </div>
  );
}
