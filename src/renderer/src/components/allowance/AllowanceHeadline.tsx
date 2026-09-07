import { CreditCard, RefreshCw } from "lucide-react";
import type { StatsSnapshot } from "@shared/types";
import { RunwayPanel } from "@renderer/components/allowance/RunwayPanel";
import { isLive } from "@renderer/lib/allowance";

/**
 * The first thing on the home screen. With a provider reporting it hands off to
 * RunwayPanel; with nothing connected it invites setup rather than showing
 * empty meters, because a row of zeroed bars looks like a reading of zero.
 */
export function AllowanceHeadline({
  snapshot,
  connecting,
  onConnectClaude,
  onOpenDetail,
}: {
  snapshot: StatsSnapshot;
  connecting: boolean;
  onConnectClaude: () => void;
  onOpenDetail: () => void;
}) {
  const live = snapshot.subscriptions.filter(isLive);

  if (live.length === 0) {
    const claude = snapshot.subscriptions.find((usage) => usage.provider === "claude");
    const waiting = claude?.capture?.state === "waiting";
    return (
      <section className="panel allowance-invite">
        <div className="allowance-invite-mark"><CreditCard size={20} /></div>
        <div className="allowance-invite-copy">
          <strong>{waiting ? "Waiting for Claude Code's first report" : "Connect an allowance to see what is left"}</strong>
          <p>
            {waiting
              ? "Claude Code sends its allowance after the next assistant response. Nothing else to do."
              : "azul-code can read how much of your Claude Code and Codex allowance is gone, and when each window resets. It reads what those tools already write on this Mac."}
          </p>
        </div>
        {claude?.capture?.state === "not-configured" ? (
          <button className="connect-button" onClick={onConnectClaude} disabled={connecting}>
            {connecting ? <><RefreshCw className="spin" size={12} /> Connecting…</> : "Connect Claude Code"}
          </button>
        ) : null}
      </section>
    );
  }

  return <RunwayPanel subscriptions={live} onOpenDetail={onOpenDetail} />;
}
