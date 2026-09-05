import { useCallback } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Info,
  RefreshCw,
} from "lucide-react";
import type { GitHubDay, StatsSnapshot } from "@shared/types";
import { buildDaySummary, buildInvoiceSummary, isDayActive, monthLabel } from "@shared/invoice";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import { Kpi } from "@renderer/components/primitives/Kpi";
import { DayCard } from "@renderer/components/github/DayCard";
import { MonthHeatGrid } from "@renderer/components/github/MonthHeatGrid";
import { RepoTotals } from "@renderer/components/github/RepoTotals";
import { useCopyToClipboard } from "@renderer/hooks/useCopyToClipboard";
import { useDailyCostIndex } from "@renderer/hooks/useDailyCostIndex";
import type { GithubMonthState } from "@renderer/hooks/useGithubMonth";
import { openUrl } from "@renderer/lib/bridge";
import { useRegisterRefresh } from "@renderer/providers/RefreshProvider";
import { relative } from "@renderer/format";

function copyLabel(state: "idle" | "copied" | "failed"): string {
  if (state === "copied") return "Copied — paste it into your invoice";
  if (state === "failed") return "Copy failed — try again";
  return "Copy invoice summary";
}

export function GithubPage({
  snapshot,
  month: monthState,
}: {
  snapshot: StatsSnapshot | null;
  month: GithubMonthState;
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
  const copyMonth = useCallback(() => {
    if (data && data.state === "ok") void copy(buildInvoiceSummary(data), "month");
  }, [copy, data]);

  const activeDays = data?.days.filter(isDayActive) ?? [];
  const hasActivity = data ? data.totals.commits > 0 || data.totals.pullRequests > 0 : false;
  const monthCopyState = stateFor("month");

  return (
    <div className="page-stack">
      <section className="panel gh-toolbar">
        <div className="month-nav">
          <button className="icon-button" onClick={() => step(-1)} title="Previous month" aria-label="Previous month"><ChevronLeft size={14} /></button>
          <strong>{monthLabel(month)}</strong>
          <button className="icon-button" disabled={month >= currentMonth} onClick={() => step(1)} title="Next month" aria-label="Next month"><ChevronRight size={14} /></button>
        </div>
        <div className="gh-toolbar-actions">
          {data && data.state === "ok" ? <span className="muted-label">fetched {relative(data.fetchedAt)} ago · @{data.login}</span> : null}
          <button className="copy-summary" onClick={copyMonth} disabled={!hasActivity} data-state={monthCopyState}>
            <ClipboardCopy size={13} />{copyLabel(monthCopyState)}
          </button>
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
      {data && data.state === "ok" ? (
        <div className={stale ? "gh-content is-stale" : "gh-content"} aria-busy={stale}>
          <section className="kpi-grid">
            <Kpi icon={GitCommitHorizontal} label="Commits" value={String(data.totals.commits)} detail={`${monthLabel(data.month)} · @${data.login}`} />
            <Kpi icon={CalendarDays} label="Active days" value={String(data.totals.activeDays)} detail="Days with commits or pull requests" accent />
            <Kpi icon={GitPullRequest} label="Pull requests" value={String(data.totals.pullRequests)} detail="Opened during this month" />
            <Kpi icon={FolderGit2} label="Projects" value={String(data.totals.repos)} detail="Repositories with your commits" />
          </section>
          <section className="split-panels">
            <div className="gh-days">
              {activeDays.map((day) => (
                <DayCard key={day.date} day={day} ai={ai} copyState={stateFor(day.date)} onCopy={copyDay} />
              ))}
              {activeDays.length === 0 ? <div className="panel"><EmptyState label="No GitHub activity recorded this month" /></div> : null}
            </div>
            <div className="gh-side">
              <MonthHeatGrid data={data} />
              <RepoTotals data={data} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
