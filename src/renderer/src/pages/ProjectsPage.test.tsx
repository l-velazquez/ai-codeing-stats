import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { GitHubMonthSnapshot, StatsSnapshot } from "@shared/types";
import { EMPTY_TOKENS } from "@shared/tokenMath";

const now = new Date(2026, 10, 4, 12).getTime();
const cutoff = new Date(2026, 5, 1).getTime();
const project = { name: "webapp", path: "/projects/webapp", cost: 600, tokens: 1000, sessions: 1, providers: ["claude" as const], lastActive: now };
const requests = { months: [] as string[], cutoffs: [] as (number | undefined)[] };
let scanImpl: (since?: number) => Promise<StatsSnapshot>;

function usage(since: number | null, cost = 600): StatsSnapshot {
  return {
    generatedAt: now, range: since === null ? "all" : "90d", since,
    projects: [{ ...project, cost }], summary: { cost, tokens: EMPTY_TOKENS },
  } as StatsSnapshot;
}

function github(month: string): GitHubMonthSnapshot {
  const at = month === "2026-06" ? cutoff : month === "2026-11" ? now - 1000 : null;
  return {
    month, state: "ok", login: "demo", detail: "", fetchedAt: now, repos: [],
    totals: { commits: at === null ? 0 : 1, activeDays: at === null ? 0 : 1, repos: at === null ? 0 : 1, pullRequests: 0 },
    days: at === null ? [] : [{
      date: `${month}-01`, commits: 1, pullRequests: [],
      repos: [{ repo: "acme/webapp", commits: [{ at, sha: month, message: "work", url: "" }] }],
    }],
  };
}

vi.mock("@renderer/lib/bridge", () => ({
  fetchGithubMonth: async (month: string) => { requests.months.push(month); return github(month); },
  fetchGithubRemotes: async () => ({ "/projects/webapp": "acme/webapp" }),
  scan: (_range: string, _refresh: boolean, since?: number) => { requests.cutoffs.push(since); return scanImpl(since); },
}));

const { useProjectCommits } = await import("@renderer/hooks/useProjectCommits");
const { ProjectsPage } = await import("./ProjectsPage");

beforeEach(() => {
  requests.months = [];
  requests.cutoffs = [];
  scanImpl = async (since) => usage(since ?? null, 60);
});

it("uses six-month spend for both ratios while preserving all-time project totals", async () => {
  render(<ProjectsPage snapshot={usage(null)} />);
  await waitFor(() => expect(screen.getByText("$30.00 / commit")).toBeInTheDocument());
  expect(screen.getByText("$30.00")).toBeInTheDocument();
  expect(screen.getAllByText("$600.00").length).toBeGreaterThan(0);
  expect(requests.cutoffs).toEqual([cutoff]);
  expect(requests.months).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
});

it("reuses selected-range spend when it already matches the commit window", async () => {
  const snapshot = usage(now - 90 * 86_400_000, 90);
  const { result } = renderHook(() => useProjectCommits(snapshot));
  await waitFor(() => expect(result.current.state).toBe("ok"));
  expect(result.current.since).toBe(snapshot.since);
  expect(result.current.byProject.get(project.path)?.cost).toBe(90);
  expect(requests.cutoffs).toEqual([]);
});

it("ignores a late all-time cost response after changing ranges", async () => {
  let release!: (snapshot: StatsSnapshot) => void;
  scanImpl = () => new Promise((resolve) => { release = resolve; });
  const { result, rerender } = renderHook(({ snapshot }) => useProjectCommits(snapshot), { initialProps: { snapshot: usage(null) } });
  const next = usage(now - 7 * 86_400_000, 7);
  rerender({ snapshot: next });
  await waitFor(() => expect(result.current.state).toBe("ok"));
  await act(async () => { release(usage(cutoff, 60)); });
  expect(result.current.since).toBe(next.since);
  expect(result.current.byProject.get(project.path)?.cost).toBe(7);
});

it("withholds ratios when period-specific spend cannot be read", async () => {
  scanImpl = () => Promise.reject(new Error("usage unavailable"));
  const snapshot = usage(null);
  const { result } = renderHook(() => useProjectCommits(snapshot));
  await waitFor(() => expect(result.current.state).toBe("error"));
  expect(result.current.byProject.size).toBe(0);
});
