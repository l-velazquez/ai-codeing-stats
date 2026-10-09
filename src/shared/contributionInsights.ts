import type { GitHubDay, GitHubMonthSnapshot } from "./types";

export interface DaySpend {
  readonly sessions: number;
  readonly cost: number;
}

export interface Streak {
  /** Consecutive active days ending today (or yesterday, if today is still empty). */
  readonly current: number;
  readonly longest: number;
}

export interface ContributionInsights {
  readonly streak: Streak;
  /** 7 weekdays (Sunday first) × 24 hours of commit counts, local time. */
  readonly punch: number[][];
  readonly punchPeak: number;
  readonly peakHour: number | null;
  readonly busiestWeekday: number | null;
  readonly mergedPullRequests: number;
  readonly aiCost: number;
  readonly aiSessions: number;
  /** AI spend divided by commits, only over days that had both. */
  readonly costPerCommit: number | null;
  /** Days where AI sessions ran but nothing reached GitHub. */
  readonly spendOnlyDays: number;
  /** Per-repo commit counts aligned to `snapshot.days`. */
  readonly repoStrips: Map<string, number[]>;
}

export function isActive(day: GitHubDay): boolean {
  return day.commits > 0 || day.pullRequests.length > 0;
}

/**
 * Streaks are measured inside the month on screen. A month view that silently
 * reached into the previous month would disagree with the calendar beside it.
 * Days after `todayKey` have not happened yet and are ignored; an empty today
 * does not break the current streak, because the day is not over.
 */
export function monthStreak(days: readonly GitHubDay[], todayKey: string): Streak {
  const past = days.filter((day) => day.date <= todayKey);
  let longest = 0;
  let run = 0;
  for (const day of past) {
    run = isActive(day) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let index = past.length - 1; index >= 0; index -= 1) {
    const day = past[index];
    if (isActive(day)) current += 1;
    else if (day.date === todayKey && current === 0) continue;
    else break;
  }
  return { current, longest };
}

function argMax(values: readonly number[]): number | null {
  let best: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] > 0 && (best === null || values[index] > values[best])) best = index;
  }
  return best;
}

export function buildContributionInsights(
  snapshot: GitHubMonthSnapshot,
  spend: ReadonlyMap<string, DaySpend>,
  todayKey: string,
): ContributionInsights {
  const punch = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const repoStrips = new Map<string, number[]>();
  let mergedPullRequests = 0;
  let aiCost = 0;
  let aiSessions = 0;
  let pairedCost = 0;
  let pairedCommits = 0;
  let spendOnlyDays = 0;

  snapshot.days.forEach((day, dayIndex) => {
    for (const group of day.repos) {
      let strip = repoStrips.get(group.repo);
      if (!strip) {
        strip = new Array<number>(snapshot.days.length).fill(0);
        repoStrips.set(group.repo, strip);
      }
      strip[dayIndex] += group.commits.length;
      for (const commit of group.commits) {
        const at = new Date(commit.at);
        punch[at.getDay()][at.getHours()] += 1;
      }
    }
    mergedPullRequests += day.pullRequests.filter((pullRequest) => pullRequest.merged).length;

    const daySpend = spend.get(day.date);
    if (daySpend) {
      aiCost += daySpend.cost;
      aiSessions += daySpend.sessions;
      if (day.commits > 0) {
        pairedCost += daySpend.cost;
        pairedCommits += day.commits;
      } else if (daySpend.sessions > 0 && !isActive(day)) {
        spendOnlyDays += 1;
      }
    }
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => punch.reduce((sum, row) => sum + row[hour], 0));
  const byWeekday = punch.map((row) => row.reduce((sum, value) => sum + value, 0));

  return {
    streak: monthStreak(snapshot.days, todayKey),
    punch,
    punchPeak: Math.max(0, ...punch.flat()),
    peakHour: argMax(byHour),
    busiestWeekday: argMax(byWeekday),
    mergedPullRequests,
    aiCost,
    aiSessions,
    costPerCommit: pairedCommits > 0 ? pairedCost / pairedCommits : null,
    spendOnlyDays,
    repoStrips,
  };
}

export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "a" : "p";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
