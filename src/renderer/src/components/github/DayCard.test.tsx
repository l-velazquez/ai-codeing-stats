import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GitHubDay } from "@shared/types";
import { DayCard } from "./DayCard";

const at = new Date(2026, 8, 5, 10, 0).getTime();

const day: GitHubDay = {
  date: "2026-09-05",
  commits: 2,
  repos: [{ repo: "acme/webapp", commits: [
    { sha: "a1f9c2e", message: "Fix checkout race", at, url: "https://github.com/acme/webapp/commit/a1f9c2e" },
    { sha: "b7d401f", message: "Add retry queue", at, url: "https://github.com/acme/webapp/commit/b7d401f" },
  ] }],
  pullRequests: [
    { number: 412, title: "Payment retry queue", repo: "acme/webapp", at, url: "https://github.com/acme/webapp/pull/412", merged: true },
    { number: 7, title: "Bump terraform provider", repo: "acme/infra", at, url: "https://github.com/acme/infra/pull/7", merged: false },
  ],
};

function renderDay() {
  return render(<DayCard day={day} ai={new Map()} copyState="idle" onCopy={() => {}} />);
}

describe("DayCard", () => {
  it("files each pull request under the project it belongs to", () => {
    const { container } = renderDay();
    const groups = [...container.querySelectorAll(".gh-repo-group")];
    const webapp = groups.find((group) => within(group as HTMLElement).queryByText("acme/webapp"))!;
    const infra = groups.find((group) => within(group as HTMLElement).queryByText("acme/infra"))!;

    expect(within(webapp as HTMLElement).getByText("Payment retry queue")).toBeInTheDocument();
    expect(within(infra as HTMLElement).getByText("Bump terraform provider")).toBeInTheDocument();
  });

  it("counts a pull-request-only project in the day summary", () => {
    renderDay();
    expect(screen.getByText(/2 commits · 2 projects/)).toBeInTheDocument();
    expect(screen.getByText("2 commits · 1 pull request")).toBeInTheDocument();
    expect(screen.getByText("1 pull request")).toBeInTheDocument();
  });
});
