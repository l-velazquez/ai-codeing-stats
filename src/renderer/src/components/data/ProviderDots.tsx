import { PROVIDERS } from "@renderer/format";
import type { Provider } from "@shared/types";

export function ProviderDots({ providers }: { providers: Provider[] }) {
  return (
    <span className="provider-dots" aria-label={providers.map((provider) => PROVIDERS[provider].label).join(", ")}>
      {providers.map((provider) => (
        <span key={provider} style={{ background: PROVIDERS[provider].color }} />
      ))}
    </span>
  );
}
