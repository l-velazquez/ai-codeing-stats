import { CreditCard, Info } from "lucide-react";
import { SubscriptionCard } from "@renderer/components/allowance/SubscriptionCard";
import type { StatsSnapshot } from "@shared/types";

export function PlansPage({
  snapshot,
  connectingClaude,
  onConnectClaude,
}: {
  snapshot: StatsSnapshot;
  connectingClaude: boolean;
  onConnectClaude: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="panel plans-intro">
        <div><h2>Allowances</h2><p>Quota percentages come from provider-reported limit events. Local activity stays separate, so estimated token cost is never confused with your subscription bill.</p></div>
        <div className="plans-live-count"><strong>{snapshot.subscriptions.filter((usage) => usage.state === "live").length}</strong><span>of {snapshot.subscriptions.length} live</span></div>
      </section>
      <div className="subscription-grid">
        {snapshot.subscriptions.map((usage) => (
          <SubscriptionCard
            key={usage.provider}
            usage={usage}
            snapshot={snapshot}
            connectingClaude={connectingClaude}
            onConnectClaude={onConnectClaude}
          />
        ))}
      </div>
      <div className="estimate-callout plans-note"><Info size={16} /><span>Codex refreshes from local limit events. Claude refreshes after responses through its official status-line integration; Tokenary stores only the two allowance windows on this Mac.</span></div>
    </div>
  );
}
