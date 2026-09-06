import { CreditCard, RefreshCw } from "lucide-react";
import type { StatsSnapshot } from "@shared/types";
import { PROVIDERS } from "@renderer/format";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { AllowanceMeter } from "@renderer/components/allowance/AllowanceMeter";
import { isLive, worstWindow } from "@renderer/lib/allowance";

/**
 * The first thing on the home screen, because the question worth asking before
 * starting a long session is whether you are about to run into a limit -- not
 * what last month cost. Allowance is independent of the selected range, and the
 * copy says so rather than letting the range control imply otherwise.
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

  return (
    <section className="allowance-headline">
      {live.map((usage) => {
        const worst = worstWindow(usage);
        return (
          <button
            key={usage.provider}
            className="panel allowance-card"
            onClick={onOpenDetail}
            title={`See ${PROVIDERS[usage.provider].label} allowance detail`}
          >
            <div className="allowance-card-head">
              <ProviderMark provider={usage.provider} />
              <div>
                <strong>{PROVIDERS[usage.provider].label}</strong>
                <span>{usage.plan ? `${usage.plan} plan` : "Subscription"}</span>
              </div>
            </div>
            {worst ? <AllowanceMeter window={worst} size="large" /> : null}
            {usage.windows.length > 1 ? (
              <span className="allowance-more">{usage.windows.length} windows tracked</span>
            ) : null}
          </button>
        );
      })}
    </section>
  );
}
