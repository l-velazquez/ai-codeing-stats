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
