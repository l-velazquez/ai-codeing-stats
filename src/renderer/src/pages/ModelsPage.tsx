import { ProviderMark } from "@renderer/components/ProviderMark";
import { ModelRow } from "@renderer/components/data/ModelRow";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { PROVIDERS, cacheRate, compact, modelName, money, percent } from "@renderer/format";
import type { StatsSnapshot } from "@shared/types";

export function ModelsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const maxCost = snapshot.models[0]?.cost ?? 1;
  return (
    <div className="page-stack">
      <section className="model-feature-grid">
        {snapshot.models.slice(0, 3).map((model) => (
          <div className="panel model-feature" key={`${model.provider}:${model.model}`}>
            <ProviderMark provider={model.provider} />
            <div className="model-feature-name"><span>{PROVIDERS[model.provider].label}</span><strong>{modelName(model.model)}</strong></div>
            <div className="model-feature-cost"><strong>{money(model.cost)}</strong><span>{compact(model.totalTokens)} tokens</span></div>
            <div className="feature-progress"><i style={{ width: `${(model.cost / maxCost) * 100}%` }} /></div>
            <div className="feature-meta"><span>{model.sessions} sessions</span><span>{percent(cacheRate(model.tokens))} cached</span><span>{money(model.savings)} saved</span></div>
          </div>
        ))}
      </section>
      <section className="panel list-panel">
        <CardTitle action={<span className="muted-label">{snapshot.models.length} detected</span>}>Complete model ledger</CardTitle>
        <div className="table-header model-row"><span>Model</span><span>Cache efficiency</span><span>Spend</span><span>Tokens</span><span>Runs</span></div>
        {snapshot.models.map((model) => <ModelRow key={`${model.provider}:${model.model}`} model={model} maxCost={maxCost} />)}
      </section>
    </div>
  );
}
