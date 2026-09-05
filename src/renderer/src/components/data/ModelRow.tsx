import { ProviderMark } from "@renderer/components/ProviderMark";
import { PROVIDERS, cacheRate, compact, modelName, money, percent } from "@renderer/format";
import type { ModelStat } from "@shared/types";

export function ModelRow({ model, maxCost }: { model: ModelStat; maxCost: number }) {
  return (
    <div className="data-row model-row">
      <div className="identity-cell">
        <ProviderMark provider={model.provider} />
        <div>
          <strong>{modelName(model.model)}</strong>
          <span>{PROVIDERS[model.provider].label}</span>
        </div>
      </div>
      <div className="bar-cell">
        <span className="mini-bar"><i style={{ width: `${Math.max(2, (model.cost / Math.max(0.01, maxCost)) * 100)}%` }} /></span>
        <span>{percent(cacheRate(model.tokens))} cached</span>
      </div>
      <div className="numeric-cell"><strong>{money(model.cost)}</strong><span>est. spend</span></div>
      <div className="numeric-cell"><strong>{compact(model.totalTokens)}</strong><span>tokens</span></div>
      <div className="numeric-cell"><strong>{model.sessions}</strong><span>sessions</span></div>
    </div>
  );
}
