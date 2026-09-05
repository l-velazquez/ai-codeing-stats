import { CreditCard, RefreshCw } from "lucide-react";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { RANGE_LABELS } from "@renderer/components/shell/RangeControl";
import { PROVIDERS, compact, money, relative } from "@renderer/format";
import { resetText } from "@renderer/lib/allowance";
import type { StatsSnapshot, SubscriptionUsage } from "@shared/types";

export function SubscriptionCard({
  usage,
  snapshot,
  connectingClaude,
  onConnectClaude,
}: {
  usage: SubscriptionUsage;
  snapshot: StatsSnapshot;
  connectingClaude: boolean;
  onConnectClaude: () => void;
}) {
  const activity = snapshot.providers.find((provider) => provider.provider === usage.provider);
  const isLive = usage.state === "live" && usage.windows.length > 0;
  return (
    <section className={`panel subscription-card${isLive ? "" : " subscription-card--unavailable"}`}>
      <div className="subscription-header">
        <div className="subscription-identity">
          <ProviderMark provider={usage.provider} />
          <div><strong>{PROVIDERS[usage.provider].label}</strong><span>{usage.plan ? `${usage.plan} plan` : "Subscription"}</span></div>
        </div>
        <span className={`subscription-state subscription-state--${isLive ? "live" : "unavailable"}`}>
          <i />{isLive ? "Live allowance" : "Activity only"}
        </span>
      </div>

      {isLive ? (
        <div className="allowance-list">
          {usage.windows.map((window) => (
            <div className="allowance" key={`${window.label}:${window.windowMinutes}`}>
              <div className="allowance-heading"><span>{window.label}</span><strong>{Math.round(window.usedPercent)}% <small>used</small></strong></div>
              <div className="allowance-track"><i style={{ width: `${window.usedPercent}%` }} /></div>
              <div className="allowance-meta"><span>{Math.round(100 - window.usedPercent)}% available</span><span>{resetText(window.resetsAt)}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="allowance-empty">
          <CreditCard size={21} />
          <strong>{usage.capture?.state === "waiting" ? "Waiting for Claude Code" : "Allowance not connected"}</strong>
          <p>{usage.detail}</p>
          {usage.capture?.state === "not-configured" ? (
            <button className="connect-button" onClick={onConnectClaude} disabled={connectingClaude}>
              {connectingClaude ? <><RefreshCw className="spin" size={12} /> Connecting…</> : "Connect Claude Code"}
            </button>
          ) : null}
        </div>
      )}

      <div className="subscription-activity">
        <div><span>Local activity</span><strong>{compact(activity?.tokens ?? 0)}</strong><small>tokens · {RANGE_LABELS[snapshot.range].toLowerCase()}</small></div>
        <div><span>Sessions</span><strong>{activity?.sessions ?? 0}</strong><small>measured locally</small></div>
        <div><span>API equivalent</span><strong>{money(activity?.cost ?? 0)}</strong><small>not your plan bill</small></div>
      </div>
      <div className="subscription-foot">
        <span>{usage.updatedAt ? `Captured ${relative(usage.updatedAt)} ago` : usage.capture?.state === "waiting" ? "Status line connected" : "Waiting for setup"}</span>
        {isLive ? <span>{usage.detail}</span> : null}
      </div>
    </section>
  );
}
