import type { DayOrder } from "./settings";
import type { GitHubDay, GitHubMonthSnapshot } from "./types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthLabel(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthIndex, 1));
}

export function dayLabel(date: string): string {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(
    new Date(year, monthIndex, day),
  );
}

export function isDayActive(day: GitHubDay): boolean {
  return day.commits > 0 || day.pullRequests.length > 0;
}

/**
 * Active days in display order. The month walk in main emits every day of the
 * month oldest-first, so "newest" is that list reversed. `filter` hands back a
 * fresh array, so reversing in place cannot disturb the snapshot.
 */
export function activeDaysInOrder(days: readonly GitHubDay[], order: DayOrder): GitHubDay[] {
  const active = days.filter(isDayActive);
  return order === "newest" ? active.reverse() : active;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function buildDaySummary(day: GitHubDay): string {
  const lines: string[] = [`${dayLabel(day.date)} — ${plural(day.commits, "commit")}`];
  for (const group of day.repos) {
    lines.push(`${group.repo} (${plural(group.commits.length, "commit")}):`);
    for (const commit of group.commits) lines.push(`  - ${commit.message}`);
  }
  if (day.pullRequests.length > 0) {
    lines.push("Pull requests:");
    for (const pullRequest of day.pullRequests) {
      lines.push(`  - ${pullRequest.merged ? "merged" : "opened"} ${pullRequest.title} (${pullRequest.repo} #${pullRequest.number})`);
    }
  }
  return lines.join("\n");
}

export function buildInvoiceSummary(snapshot: GitHubMonthSnapshot): string {
  const header = `${monthLabel(snapshot.month)} — GitHub contributions (@${snapshot.login})`;
  const active = snapshot.days.filter(isDayActive);
  if (active.length === 0) return `${header}\n\nNo GitHub activity recorded.`;
  const body = active.map(buildDaySummary).join("\n\n");
  const { commits, pullRequests, repos, activeDays } = snapshot.totals;
  const footer = `Total: ${plural(commits, "commit")} · ${plural(pullRequests, "pull request")} · ${plural(repos, "project")} · ${plural(activeDays, "active day")}`;
  return [header, "", body, "", footer].join("\n");
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function shiftMonthKey(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + delta;
  const shifted = new Date(year, monthIndex, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}

/**
 * The month restricted to the given projects, with totals recomputed. Personal
 * projects are unticked in the copy panel and must vanish from every figure in
 * the copied text, not just from the list -- a footer still counting them would
 * put hours on an invoice that were never billable.
 */
export function filterSnapshotRepos(snapshot: GitHubMonthSnapshot, include: (repo: string) => boolean): GitHubMonthSnapshot {
  const days: GitHubDay[] = snapshot.days.map((day) => {
    const repos = day.repos.filter((group) => include(group.repo));
    return {
      date: day.date,
      commits: repos.reduce((sum, group) => sum + group.commits.length, 0),
      repos,
      pullRequests: day.pullRequests.filter((pullRequest) => include(pullRequest.repo)),
    };
  });
  const repos = snapshot.repos.filter((repo) => include(repo.repo));
  return {
    ...snapshot,
    days,
    repos,
    totals: {
      commits: days.reduce((sum, day) => sum + day.commits, 0),
      pullRequests: days.reduce((sum, day) => sum + day.pullRequests.length, 0),
      activeDays: days.filter(isDayActive).length,
      repos: repos.length,
    },
  };
}

function shortDay(date: string): string {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(year, monthIndex, day));
}

/**
 * The same month grouped by project: one heading per repository, a generated
 * one-line description of the work, then its commits and pull requests in date
 * order. This is the shape a client invoice usually wants -- "what did you do
 * on our project" -- where the by-day summary answers "what did you do today".
 */
export function buildProjectInvoice(snapshot: GitHubMonthSnapshot): string {
  const header = `${monthLabel(snapshot.month)} — work by project (@${snapshot.login})`;
  const projects = new Map<string, { commits: { date: string; message: string }[]; pullRequests: GitHubDay["pullRequests"]; days: Set<string> }>();
  const projectFor = (repo: string) => {
    let project = projects.get(repo);
    if (!project) {
      project = { commits: [], pullRequests: [], days: new Set() };
      projects.set(repo, project);
    }
    return project;
  };
  for (const day of snapshot.days) {
    for (const group of day.repos) {
      const project = projectFor(group.repo);
      for (const commit of group.commits) project.commits.push({ date: day.date, message: commit.message });
      if (group.commits.length > 0) project.days.add(day.date);
    }
    for (const pullRequest of day.pullRequests) {
      const project = projectFor(pullRequest.repo);
      project.pullRequests.push(pullRequest);
      project.days.add(day.date);
    }
  }
  if (projects.size === 0) return `${header}\n\nNo GitHub activity recorded.`;

  const ordered = [...projects.entries()].sort((a, b) => b[1].commits.length - a[1].commits.length || a[0].localeCompare(b[0]));
  const sections = ordered.map(([repo, project]) => {
    const dates = [...project.days].sort();
    const span = dates.length > 1 ? `${shortDay(dates[0])} – ${shortDay(dates.at(-1)!)}` : shortDay(dates[0]);
    const merged = project.pullRequests.filter((pullRequest) => pullRequest.merged).length;
    const description = [
      `${plural(project.commits.length, "commit")} across ${plural(dates.length, "day")} (${span})`,
      project.pullRequests.length > 0 ? `${plural(project.pullRequests.length, "pull request")}, ${merged} merged` : null,
    ].filter(Boolean).join(" · ");
    const lines = [repo, description];
    for (const commit of project.commits) lines.push(`  - ${shortDay(commit.date)}: ${commit.message}`);
    for (const pullRequest of project.pullRequests) {
      lines.push(`  - ${pullRequest.merged ? "Merged" : "Opened"} #${pullRequest.number}: ${pullRequest.title}`);
    }
    return lines.join("\n");
  });
  const { commits, pullRequests, repos, activeDays } = snapshot.totals;
  const footer = `Total: ${plural(commits, "commit")} · ${plural(pullRequests, "pull request")} · ${plural(repos, "project")} · ${plural(activeDays, "active day")}`;
  return [header, "", sections.join("\n\n"), "", footer].join("\n");
}
