import { Sparkles } from "lucide-react";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { PROVIDERS, compact, money, percent } from "@renderer/format";
import type { Provider, StatsSnapshot } from "@shared/types";

export function ProviderBreakdown({ snapshot }: { snapshot: StatsSnapshot }) {
  const max = Math.max(0.01, snapshot.summary.cost);
  return (
    <div className="panel provider-panel">
      <CardTitle action={<span className="muted-label">share</span>}>Providers</CardTitle>
      <div className="provider-stack" aria-label="Provider cost distribution">
        {snapshot.providers.map((provider) => (
          <i
            key={provider.provider}
            style={{ width: `${(provider.cost / max) * 100}%`, background: PROVIDERS[provider.provider].color }}
          />
        ))}
      </div>
      <div className="provider-list">
        {snapshot.providers.map((provider) => (
          <div className="provider-item" key={provider.provider}>
            <ProviderMark provider={provider.provider} />
            <div><strong>{PROVIDERS[provider.provider].label}</strong><span>{provider.sessions} sessions · {compact(provider.tokens)} tokens</span></div>
            <div className="provider-value"><strong>{money(provider.cost)}</strong><span>{percent(provider.cost / max)}</span></div>
          </div>
        ))}
      </div>
      <div className="provider-footnote"><Sparkles size={13} /><span>Caching avoided an estimated <strong>{money(snapshot.summary.savings)}</strong> in input processing.</span></div>
    </div>
  );
}
