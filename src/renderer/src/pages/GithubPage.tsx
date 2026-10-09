import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GitBranch,
  Info,
  RefreshCw,
} from "lucide-react";
import type { DayOrder } from "@shared/settings";
import type { GitHubDay, StatsSnapshot } from "@shared/types";
import { activeDaysInOrder, buildDaySummary, isDayActive, monthLabel } from "@shared/invoice";
import { buildContributionInsights, type ContributionInsights } from "@shared/contributionInsights";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import { StatRail, type Stat } from "@renderer/components/primitives/StatRail";
import { DayCard } from "@renderer/components/github/DayCard";
import { InvoiceCopyPanel } from "@renderer/components/github/InvoiceCopyPanel";
import { RepoTotals } from "@renderer/components/github/RepoTotals";
import { ShipClock } from "@renderer/components/github/ShipClock";
import { ShipRibbon } from "@renderer/components/github/ShipRibbon";
import { useCopyToClipboard } from "@renderer/hooks/useCopyToClipboard";
import { useDailyCostIndex } from "@renderer/hooks/useDailyCostIndex";
import { useInvoiceExclusions } from "@renderer/hooks/useInvoiceExclusions";
import type { GithubMonthState } from "@renderer/hooks/useGithubMonth";
import { openUrl } from "@renderer/lib/bridge";
import { useRegisterRefresh } from "@renderer/providers/RefreshProvider";
import { localDayKey, money, relative } from "@renderer/format";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function insightStats(insights: ContributionInsights, isCurrentMonth: boolean, activeDays: number, commits: number): Stat[] {
  const { streak, costPerCommit, spendOnlyDays } = insights;
  return [
    isCurrentMonth
      ? { label: "Current streak", value: plural(streak.current, "day"), detail: `Longest this month: ${plural(streak.longest, "day")}` }
      : { label: "Longest streak", value: plural(streak.longest, "day"), detail: "Consecutive active days" },
    { label: "AI cost per commit", value: costPerCommit === null ? "—" : money(costPerCommit), detail: "Spend ÷ commits on days with both" },
    { label: "Commits per active day", value: activeDays > 0 ? (commits / activeDays).toFixed(1) : "—", detail: `Over ${plural(activeDays, "active day")}` },
    { label: "Spend-only days", value: String(spendOnlyDays), detail: spendOnlyDays > 0 ? "AI sessions ran, nothing was pushed" : "Every AI day reached GitHub" },
  ];
}

export function GithubPage({
  snapshot,
  month: monthState,
  order,
  onToggleOrder,
}: {
  snapshot: StatsSnapshot | null;
  month: GithubMonthState;
  order: DayOrder;
  onToggleOrder: () => void;
}) {
  const { month, currentMonth, data, stale, loading, error, step, reload } = monthState;
  const { copy, stateFor } = useCopyToClipboard();

  // Its own full-history index rather than snapshot.daily, which only covers the
  // selected range and so hid the correlation on older months entirely.
  const ai = useDailyCostIndex(snapshot?.generatedAt ?? null);

  useRegisterRefresh(reload, loading);

  const copyDay = useCallback(
    (day: GitHubDay) => void copy(buildDaySummary(day), day.date),
    [copy],
  );
  const copyMonth = useCallback((text: string) => void copy(text, "month"), [copy]);
  const { excluded, setExcluded } = useInvoiceExclusions();

  // Only the most recent active day starts open; the rest collapse to their
  // header line so a busy month is scannable. Reset whenever the month changes.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const loadedMonth = data?.month ?? null;
  useEffect(() => {
    const latest = data?.days.filter(isDayActive).at(-1);
    setExpanded(new Set(latest ? [latest.date] : []));
    // Keyed on the month, not the snapshot: a background refresh of the same
    // month must not fold away days the user opened.
  }, [loadedMonth]);
  const toggleDay = useCallback((date: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);
  const jumpToDay = useCallback((date: string) => {
    setExpanded((current) => (current.has(date) ? current : new Set([...current, date])));
    // After the expanded card has rendered, so it centres on its full height.
    requestAnimationFrame(() => document.getElementById(`gh-day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);

  const activeDays = activeDaysInOrder(data?.days ?? [], order);
  const newestFirst = order === "newest";
  const hasActivity = data ? data.totals.commits > 0 || data.totals.pullRequests > 0 : false;
  const monthCopyState = stateFor("month");
  const allExpanded = activeDays.length > 0 && activeDays.every((day) => expanded.has(day.date));
  const todayKey = localDayKey();
  const insights = useMemo(
    () => (data && data.state === "ok" ? buildContributionInsights(data, ai, todayKey) : null),
    [data, ai, todayKey],
  );

  return (
    <div className="page-stack">
      <section className="panel gh-toolbar">
        <div className="month-nav">
          <button className="icon-button" onClick={() => step(-1)} title="Previous month" aria-label="Previous month"><ChevronLeft size={14} /></button>
          <strong>{monthLabel(month)}</strong>
          <button className="icon-button" disabled={month >= currentMonth} onClick={() => step(1)} title="Next month" aria-label="Next month"><ChevronRight size={14} /></button>
        </div>
        <div className="gh-toolbar-actions">
          <button
            className="order-toggle"
            onClick={onToggleOrder}
            title={newestFirst ? "Showing newest day first" : "Showing oldest day first"}
            aria-label={`Day order: ${newestFirst ? "newest" : "oldest"} first. Activate to reverse.`}
          >
            {newestFirst ? <ArrowDownWideNarrow size={13} /> : <ArrowUpNarrowWide size={13} />}
            {newestFirst ? "Newest first" : "Oldest first"}
          </button>
          <button
            className="order-toggle"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(activeDays.map((day) => day.date)))}
            disabled={activeDays.length === 0}
          >
            {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
          {data && data.state === "ok" ? <span className="muted-label">fetched {relative(data.fetchedAt)} ago · @{data.login}</span> : null}
          {data && data.state === "ok" ? (
            <InvoiceCopyPanel data={data} excluded={excluded} onExcludedChange={setExcluded} copyState={monthCopyState} onCopy={copyMonth} />
          ) : null}
          <span className="visually-hidden" role="status">{monthCopyState === "copied" ? "Invoice summary copied" : monthCopyState === "failed" ? "Copy failed" : ""}</span>
        </div>
      </section>

      {error ? <div className="warning-banner" role="alert"><Info size={15} /><span>{error}</span><button onClick={reload}>Try again</button></div> : null}

      {data?.detail ? <div className="warning-banner warning-banner--soft"><Info size={15} /><span>{data.detail}</span></div> : null}

      {loading && data === null ? (
        <div className="panel gh-loading">
          <div className="loading-mark"><GitBranch size={20} /></div>
          <strong>Fetching your GitHub month</strong>
          <span>Listing repositories, commits, and pull requests…</span>
          <div className="loading-bar"><i /></div>
        </div>
      ) : null}

      {data && data.state === "setup" ? (
        <div className="panel gh-setup">
          <GitBranch size={22} />
          <strong>{data.setup?.reason === "missing-cli" ? "Install GitHub CLI" : "Connect your GitHub account"}</strong>
          <p>{data.detail}</p>
          <code>{data.setup?.command ?? "gh auth login"}</code>
          <div className="gh-setup-actions">
            {data.setup ? <button className="text-action" onClick={() => openUrl(data.setup!.helpUrl)}><ArrowUpRight size={12} /> Open setup guide</button> : null}
            <button className="copy-summary" onClick={reload}><RefreshCw size={13} /> Check again</button>
          </div>
        </div>
      ) : null}

      {/* Kept mounted while the next month loads. Blanking this out on every
          arrow click unmounted the whole page and jumped the layout. */}
      {data && data.state === "ok" && insights ? (
        <div className={stale ? "gh-content is-stale" : "gh-content"} aria-busy={stale}>
          <ShipRibbon data={data} spend={ai} insights={insights} todayKey={todayKey} onJump={jumpToDay} />
          {hasActivity ? <StatRail stats={insightStats(insights, month === currentMonth, data.totals.activeDays, data.totals.commits)} /> : null}
          <section className="split-panels">
            <div className="gh-days">
              {activeDays.map((day) => (
                <DayCard key={day.date} day={day} ai={ai} copyState={stateFor(day.date)} onCopy={copyDay} expanded={expanded.has(day.date)} onToggle={toggleDay} />
              ))}
              {activeDays.length === 0 ? <div className="panel"><EmptyState label="No GitHub activity recorded this month" /></div> : null}
            </div>
            <div className="gh-side">
              <ShipClock insights={insights} />
              <RepoTotals data={data} insights={insights} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
