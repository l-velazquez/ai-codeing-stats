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
});

describe("AllowanceHeadline", () => {
  it("leads with the window closest to its limit", () => {
    render(
      <AllowanceHeadline snapshot={snapshot([live])} connecting={false} onConnectClaude={vi.fn()} onOpenDetail={vi.fn()} />,
    );
    // 91% weekly, not the roomier 24% five-hour window: the tighter one is
    // what will actually stop you working.
    expect(screen.getByRole("progressbar", { name: /Weekly limit/ })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /5-hour/ })).not.toBeInTheDocument();
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
