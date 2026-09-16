import type { SubscriptionWindow } from "@shared/types";
import { windowAfterReset } from "@shared/allowance";
import { headroom, PRESSURE_LABELS, pressureFor, resetText } from "@renderer/lib/allowance";

/**
 * One allowance window. The fill is coloured by pressure and the state is also
 * written out, so the reading never depends on colour alone -- the previous bar
 * used the same accent gradient at 5% used as at 95%.
 */
export function AllowanceMeter({
  window: allowance,
  size = "regular",
  now = Date.now(),
}: {
  window: SubscriptionWindow;
  size?: "regular" | "large";
  now?: number;
}) {
  const current = windowAfterReset(allowance, now);
  const used = Math.round(current.usedPercent);
  const pressure = pressureFor(current, now);

  return (
    <div className={`allowance allowance--${size}`} data-pressure={pressure}>
      <div className="allowance-heading">
        <span>{allowance.label}</span>
        <strong>{used}% <small>used</small></strong>
      </div>
      <div
        className="allowance-track"
        role="progressbar"
        aria-label={`${allowance.label} allowance`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
        aria-valuetext={`${used}% used, ${PRESSURE_LABELS[pressure].toLowerCase()}. ${resetText(current.resetsAt, now)}.`}
      >
        <i style={{ width: `${Math.min(100, Math.max(0, current.usedPercent))}%` }} />
      </div>
      <div className="allowance-meta">
        <span>{Math.round(headroom(current, now))}% left · {PRESSURE_LABELS[pressure]}</span>
        <span>{resetText(current.resetsAt, now)}</span>
      </div>
    </div>
  );
}
