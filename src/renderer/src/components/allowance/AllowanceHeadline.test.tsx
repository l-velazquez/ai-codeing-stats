import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StatsSnapshot, SubscriptionUsage } from "@shared/types";
import { AllowanceHeadline } from "./AllowanceHeadline";
import { AllowanceMeter } from "./AllowanceMeter";

function snapshot(subscriptions: SubscriptionUsage[]): StatsSnapshot {
  return { subscriptions } as StatsSnapshot;
}

const live: SubscriptionUsage = {
  provider: "claude",
  state: "live",
  plan: null,
  updatedAt: Date.now(),
  windows: [
    { label: "5-hour limit", usedPercent: 24, windowMinutes: 300, resetsAt: Date.now() + 3_600_000 },
    { label: "Weekly limit", usedPercent: 91, windowMinutes: 10_080, resetsAt: Date.now() + 86_400_000 },
  ],
  detail: "",
};

const notConfigured: SubscriptionUsage = {
  provider: "claude",
  state: "unavailable",
  plan: null,
  updatedAt: null,
  windows: [],
  detail: "",
  capture: { kind: "claude-statusline", state: "not-configured" },
};

describe("AllowanceMeter", () => {
  it("exposes the reading to assistive tech, not just to colour", () => {
    render(<AllowanceMeter window={live.windows[1]!} />);
    const bar = screen.getByRole("progressbar", { name: /Weekly limit/ });
    expect(bar).toHaveAttribute("aria-valuenow", "91");
    expect(bar.getAttribute("aria-valuetext")).toContain("nearly used up");
  });

  it("names the pressure step in visible text too", () => {
    render(<AllowanceMeter window={live.windows[0]!} />);
    expect(screen.getByText(/Comfortable/)).toBeInTheDocument();
  });

  it("refills an expired window from its known reset time", () => {
    const reset = Date.now();
    render(<AllowanceMeter window={{ ...live.windows[0]!, usedPercent: 82, resetsAt: reset - 1 }} now={reset} />);
    expect(screen.getByRole("progressbar", { name: /5-hour limit/ })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText(/100\s*% left/)).toBeInTheDocument();
  });
});

describe("AllowanceHeadline", () => {
  it("leads with the window that stops you first, not the fullest one", () => {
    render(
      <AllowanceHeadline snapshot={snapshot([live])} connecting={false} onConnectClaude={vi.fn()} onOpenDetail={vi.fn()} />,
    );
    // The weekly window is 91% gone and, six days into seven, projected to run
    // out before it resets. The five-hour window is roomier but never runs out,
    // so it is demoted to the secondary rail rather than leading.
    expect(screen.getByText(/^9% left\./)).toBeInTheDocument();
    expect(screen.getByText("76% left")).toBeInTheDocument();
  });

  it("states the pace projection in words, not only in the chart", () => {
    render(
      <AllowanceHeadline snapshot={snapshot([live])} connecting={false} onConnectClaude={vi.fn()} onOpenDetail={vi.fn()} />,
    );
    expect(screen.getByText(/On this pace you hit the limit at/)).toBeInTheDocument();
  });

  it("falls back to a plain meter when the window is too young to read a pace", () => {
    const fresh: SubscriptionUsage = {
      ...live,
      windows: [{ label: "5-hour limit", usedPercent: 3, windowMinutes: 300, resetsAt: Date.now() + 299 * 60_000 }],
    };
    render(
      <AllowanceHeadline snapshot={snapshot([fresh])} connecting={false} onConnectClaude={vi.fn()} onOpenDetail={vi.fn()} />,
    );
    expect(screen.getByText(/Too early in this window to read a pace/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /5-hour limit/ })).toBeInTheDocument();
  });

  it("says when the reading itself is stale rather than projecting from it", () => {
    const stale: SubscriptionUsage = { ...live, updatedAt: Date.now() - 40 * 60_000 };
    render(
      <AllowanceHeadline snapshot={snapshot([stale])} connecting={false} onConnectClaude={vi.fn()} onOpenDetail={vi.fn()} />,
    );
    expect(screen.getByText(/last reported this 40m ago/)).toBeInTheDocument();
    expect(screen.queryByText(/On this pace/)).not.toBeInTheDocument();
  });

  it("invites setup instead of showing empty meters when nothing is connected", async () => {
    const onConnect = vi.fn();
    render(
      <AllowanceHeadline snapshot={snapshot([notConfigured])} connecting={false} onConnectClaude={onConnect} onOpenDetail={vi.fn()} />,
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Connect Claude Code/ }));
    expect(onConnect).toHaveBeenCalled();
  });

  it("says it is waiting once the status line is installed", () => {
    render(
      <AllowanceHeadline
        snapshot={snapshot([{ ...notConfigured, capture: { kind: "claude-statusline", state: "waiting" } }])}
        connecting={false}
        onConnectClaude={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByText(/Waiting for Claude Code/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument();
  });
});
