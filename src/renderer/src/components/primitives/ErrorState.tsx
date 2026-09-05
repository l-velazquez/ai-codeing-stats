import { TriangleAlert } from "lucide-react";

/**
 * Shown when a first scan fails and there is nothing to fall back to. The old
 * code rendered the loading panel whenever the snapshot was null, so this case
 * showed an error banner above a spinner that ran forever.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="loading-screen" role="alert">
      <div className="loading-mark loading-mark--error"><TriangleAlert size={23} /></div>
      <strong>Tokenary could not read local usage</strong>
      <span>{message}</span>
      <button className="copy-summary" onClick={onRetry}>Try again</button>
    </div>
  );
}
