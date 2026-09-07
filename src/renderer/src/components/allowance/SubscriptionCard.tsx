import { CreditCard, RefreshCw } from "lucide-react";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { RANGE_LABELS } from "@renderer/components/shell/RangeControl";
import { PROVIDERS, compact, money, relative } from "@renderer/format";
import { AllowanceMeter } from "@renderer/components/allowance/AllowanceMeter";
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
  const captured = usage.updatedAt === null ? null : relative(usage.updatedAt);
  const capturedAt = captured === null ? null : captured === "now" ? "Captured just now" : `Captured ${captured} ago`;
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
          {/* The same meter the home screen uses. This markup was duplicated
              inline, so these bars painted the accent gradient at every level
              while the home screen coloured by pressure -- one window read as
              two different states depending on which page you were on. */}
          {usage.windows.map((window) => (
            <AllowanceMeter key={`${window.label}:${window.windowMinutes}`} window={window} />
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
        <span>{capturedAt ?? (usage.capture?.state === "waiting" ? "Status line connected" : "Waiting for setup")}</span>
        {isLive ? <span>{usage.detail}</span> : null}
      </div>
    </section>
  );
}
