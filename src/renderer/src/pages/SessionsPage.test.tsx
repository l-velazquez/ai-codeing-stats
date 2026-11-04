import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { EMPTY_TOKENS } from "@shared/tokenMath";
import type { SessionStat, StatsSnapshot } from "@shared/types";
import { SessionsPage } from "./SessionsPage";

function snapshot(count = 120, range: StatsSnapshot["range"] = "all"): StatsSnapshot {
  const sessions: SessionStat[] = Array.from({ length: count }, (_, index) => ({
    id: String(index), project: `work-${index + 1}`, path: "/project", provider: "codex",
    model: index === 100 ? "2 models" : "gpt-5.5",
    models: index === 100 ? ["gpt-5.5", "gpt-6.1-sol"] : ["gpt-5.5"],
    startedAt: 1000, endedAt: 2000, cost: 1, savings: 0, totalTokens: 10,
    tokens: EMPTY_TOKENS, records: 1, priced: true,
  }));
  return { range, sessions } as StatsSnapshot;
}

it("searches every model in a mixed-model session across the full ledger", async () => {
  render(<SessionsPage snapshot={snapshot()} />);
  await userEvent.type(screen.getByRole("textbox", { name: /search sessions/i }), " GPT-6.1-SOL ");
  expect(screen.getByText("work-101")).toBeInTheDocument();
  expect(screen.getByText("1 of 120 sessions")).toBeInTheDocument();
  expect(screen.queryByText("work-1")).not.toBeInTheDocument();
});

it("renders at most 50 sessions and lets users navigate the complete result", async () => {
  const { container } = render(<SessionsPage snapshot={snapshot()} />);
  expect(container.querySelectorAll(".session-row")).toHaveLength(50);
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("work-51")).toBeInTheDocument();
  expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(container.querySelectorAll(".session-row")).toHaveLength(20);
  expect(screen.getByText("work-120")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(screen.getByText("work-51")).toBeInTheDocument();
});

it("starts at the first page after searching or switching the date range", async () => {
  const { rerender } = render(<SessionsPage snapshot={snapshot()} />);
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  const search = screen.getByRole("textbox", { name: /search sessions/i });
  await userEvent.type(search, "codex");
  expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  rerender(<SessionsPage snapshot={snapshot(120, "30d")} />);
  expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
});

it("keeps a valid page when a live refresh removes sessions", async () => {
  const { rerender, container } = render(<SessionsPage snapshot={snapshot()} />);
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  rerender(<SessionsPage snapshot={snapshot(60)} />);
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  expect(container.querySelectorAll(".session-row")).toHaveLength(10);
  expect(screen.getByText("work-60")).toBeInTheDocument();
});

it("shows an empty result without pagination when nothing matches", async () => {
  render(<SessionsPage snapshot={snapshot()} />);
  await userEvent.type(screen.getByRole("textbox", { name: /search sessions/i }), "missing");
  expect(screen.getByText("No matching sessions")).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Session pages" })).not.toBeInTheDocument();
});
