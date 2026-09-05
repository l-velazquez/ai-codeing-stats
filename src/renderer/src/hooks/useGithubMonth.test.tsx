import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubMonthSnapshot } from "@shared/types";

// Plain function rather than vi.fn: a spy's derived result promise surfaces
// rejections this hook has already handled.
let impl: (month: string, refresh?: boolean) => Promise<GitHubMonthSnapshot> = async (month) =>
  monthFixture(month);
const calls: { month: string; refresh: boolean }[] = [];

vi.mock("@renderer/lib/bridge", () => ({
  fetchGithubMonth: (month: string, refresh = false) => {
    calls.push({ month, refresh });
    return impl(month, refresh);
  },
}));

const { useGithubMonth } = await import("./useGithubMonth");

function monthFixture(month: string): GitHubMonthSnapshot {
  return {
    month,
    login: "demo",
    state: "ok",
    detail: "",
    fetchedAt: Date.now(),
    days: [],
    repos: [],
    totals: { commits: 3, activeDays: 1, repos: 1, pullRequests: 0 },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 60));

beforeEach(() => {
  calls.length = 0;
  impl = async (month) => monthFixture(month);
});

describe("useGithubMonth", () => {
  it("loads the current month on mount", async () => {
    const { result } = renderHook(() => useGithubMonth());
    await flush();
    expect(result.current.data?.month).toBe(result.current.currentMonth);
    expect(result.current.stale).toBe(false);
  });

  it("keeps the previous month rendered while the next one loads", async () => {
    const { result } = renderHook(() => useGithubMonth());
    await flush();
    const first = result.current.month;

    // Hold the next response open so the in-between state is observable.
    let release: (value: GitHubMonthSnapshot) => void = () => {};
    impl = (month) => new Promise((resolve) => { release = resolve; void month; });

    act(() => result.current.step(-1));
    await flush();

    // The old code derived its view as `data.month === month ? data : null`,
    // which unmounted the entire page on every arrow click.
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.month).toBe(first);
    expect(result.current.stale).toBe(true);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      release(monthFixture(result.current.month));
      await flush();
    });
    expect(result.current.stale).toBe(false);
  });

  it("will not step past the current month", async () => {
    const { result } = renderHook(() => useGithubMonth());
    await flush();
    const current = result.current.month;
    act(() => result.current.step(1));
    await flush();
    expect(result.current.month).toBe(current);
  });

  it("surfaces a failure without discarding what is already shown", async () => {
    const { result } = renderHook(() => useGithubMonth());
    await flush();
    impl = async () => {
      throw new Error("rate limited");
    };
    act(() => result.current.reload());
    await flush();
    expect(result.current.error).toBe("rate limited");
    expect(result.current.data).not.toBeNull();
  });

  it("asks for a bypass of the cache when reloading", async () => {
    const { result } = renderHook(() => useGithubMonth());
    await flush();
    act(() => result.current.reload());
    await flush();
    expect(calls.at(-1)?.refresh).toBe(true);
  });
});
