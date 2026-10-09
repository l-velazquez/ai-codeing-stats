import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GitHubDay, GitHubMonthSnapshot } from "@shared/types";
import type { DayOrder } from "@shared/settings";
import { RefreshProvider } from "@renderer/providers/RefreshProvider";

// The real index calls scan("all") through the bridge; the page only reads it
// for the per-day AI chip, which is not what these tests are about.
vi.mock("@renderer/hooks/useDailyCostIndex", () => ({ useDailyCostIndex: () => new Map() }));
vi.mock("@renderer/lib/bridge", () => ({
  openUrl: () => {},
  readSettings: () => Promise.resolve({ invoiceExcludedRepos: [] }),
  writeSettings: () => Promise.resolve({}),
}));

const { GithubPage } = await import("./GithubPage");

function day(date: string, commits: number): GitHubDay {
  return {
    date,
    commits,
    repos: commits > 0
      ? [{ repo: "acme/webapp", commits: [{ sha: "a1f9c2e", message: `Work on ${date}`, at: 0, url: "u" }] }]
      : [],
    pullRequests: [],
  };
}

// Zero-filled and oldest-first, exactly as the month walk in main emits it.
const days = [day("2026-09-01", 1), day("2026-09-02", 0), day("2026-09-03", 2), day("2026-09-04", 1)];

const snapshot: GitHubMonthSnapshot = {
  month: "2026-09",
  login: "demo",
  state: "ok",
  detail: "",
  fetchedAt: Date.now(),
  days,
  repos: [{ repo: "acme/webapp", commits: 4, activeDays: 3, lastAt: 0 }, { repo: "me/dotfiles", commits: 1, activeDays: 1, lastAt: 0 }],
  totals: { commits: 4, activeDays: 3, repos: 1, pullRequests: 0 },
};

function renderPage(order: DayOrder, onToggleOrder = () => {}) {
  return render(
    <RefreshProvider>
      <GithubPage
        snapshot={null}
        order={order}
        onToggleOrder={onToggleOrder}
        month={{
          month: "2026-09",
          currentMonth: "2026-09",
          data: snapshot,
          stale: false,
          loading: false,
          error: null,
          step: () => {},
          reload: () => {},
        }}
      />
    </RefreshProvider>,
  );
}

function renderedDayIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".gh-day")].map((node) => node.id);
}

describe("GithubPage day order", () => {
  it("renders the ledger oldest first by default", () => {
    const { container } = renderPage("oldest");
    expect(renderedDayIds(container)).toEqual(["gh-day-2026-09-01", "gh-day-2026-09-03", "gh-day-2026-09-04"]);
    expect(screen.getByRole("button", { name: /oldest first/i })).toBeInTheDocument();
  });

  it("reverses the ledger when newest first is stored", () => {
    const { container } = renderPage("newest");
    expect(renderedDayIds(container)).toEqual(["gh-day-2026-09-04", "gh-day-2026-09-03", "gh-day-2026-09-01"]);
    expect(screen.getByRole("button", { name: /newest first/i })).toBeInTheDocument();
  });

  it("keeps the month ribbon in calendar order whichever way the ledger runs", () => {
    const { container } = renderPage("newest");
    const cells = [...container.querySelectorAll(".ship-day")].map((cell) => cell.getAttribute("aria-label"));
    expect(cells[0]).toContain("2026-09-01");
    expect(cells.at(-1)).toContain("2026-09-04");
  });

  it("asks the shell to flip the order when the toggle is clicked", async () => {
    const onToggleOrder = vi.fn();
    renderPage("oldest", onToggleOrder);
    await userEvent.click(screen.getByRole("button", { name: /oldest first/i }));
    expect(onToggleOrder).toHaveBeenCalledOnce();
  });

  it("opens only the most recent day and expands the rest on demand", async () => {
    const { container } = renderPage("oldest");
    const open = () => [...container.querySelectorAll(".gh-day:not(.is-collapsed)")].map((node) => node.id);
    expect(open()).toEqual(["gh-day-2026-09-04"]);
    await userEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(open()).toHaveLength(3);
  });
});

describe("GithubPage invoice copy", () => {
  it("lists each project with a checkbox and leaves unticked ones out of the copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage("oldest");
    await userEvent.click(screen.getByRole("button", { name: /copy invoice summary/i }));
    const dialog = screen.getByRole("dialog", { name: /copy invoice summary/i });
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /acme\/webapp/ }));
    expect(within(dialog).getByRole("button", { name: "Nothing selected" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /acme\/webapp/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /^Copy 3 commits from/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("acme/webapp\n3 commits across 3 days"));
  });
});
