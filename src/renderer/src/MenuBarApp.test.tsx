import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MenuBarView } from "./MenuBarApp";
import { localDayKey, type MenuBarState } from "@shared/menuBar";

// Local noon keeps the stale-report scenario on the same calendar day.
const now = new Date(2026, 8, 5, 12).getTime();
const state: MenuBarState = { refreshing: false, error: null, summary: {
  day: localDayKey(now), updatedAt: now, cost: 4.2, tokens: 1200, pricedPercent: 1, providers: [],
  sources: [{ provider: "codex", label: "Codex", path: "", state: "connected", files: 1, records: 1, detail: "" }],
  subscriptions: [{ provider: "codex", state: "live", plan: null, updatedAt: now, detail: "", windows: [
    { label: "Session", usedPercent: 25, windowMinutes: 300, resetsAt: now + 3600_000 },
  ] }],
} };
const actions = () => ({ onRefresh: vi.fn(), onOpen: vi.fn(), onSettings: vi.fn(), onQuit: vi.fn() });

it("keeps the padded wrapper main measures the window from", () => {
  const { container } = render(<MenuBarView state={state} now={now} {...actions()} />);
  // Moving this padding back onto the scroller would silently under-report the
  // window height by the padding. See usePanelHeight and menubar.css.
  expect(container.querySelector(".menubar-content > .menubar-measure")).toBeTruthy();
});

it("shows API-equivalent dollars and remaining allowance with working actions", () => {
  const handlers = actions();
  render(<MenuBarView state={state} now={now} {...handlers} />);
  expect(screen.getByText("$4.20")).toBeInTheDocument();
  expect(screen.getByText(/not your subscription bill/)).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  fireEvent.click(screen.getByRole("button", { name: "Refresh usage" }));
  fireEvent.click(screen.getByRole("button", { name: "Open azul-code" }));
  fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Quit" }));
  for (const action of Object.values(handlers)) expect(action).toHaveBeenCalledOnce();
});

it("retains the last allowance reading after a failed refresh and explains its age", () => {
  render(<MenuBarView state={{ ...state, error: "Read failed" }} now={now + 16 * 60_000} {...actions()} />);
  expect(screen.getByText("$4.20")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Showing the last available scan");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  expect(screen.getByText("75% left")).toBeInTheDocument();
  expect(screen.getByText("Last report · Resets in 44m")).toBeInTheDocument();
});

it("refills a bar when its known reset time passes without another report", () => {
  render(<MenuBarView state={state} now={now + 3_600_000} {...actions()} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect(screen.getByText("100% left")).toBeInTheDocument();
  expect(screen.getByText("Reset due · bar reset automatically")).toBeInTheDocument();
});

it("retries a first-load failure without showing invented zero-dollar totals", () => {
  render(<MenuBarView state={{ summary: null, refreshing: false, error: "Scan failed" }} now={now} {...actions()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Use Refresh to try again");
  expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh usage" })).toBeEnabled();
});
