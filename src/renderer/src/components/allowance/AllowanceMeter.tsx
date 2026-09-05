import type { SubscriptionWindow } from "@shared/types";
import { headroom, PRESSURE_LABELS, pressureOf, resetText } from "@renderer/lib/allowance";

/**
 * One allowance window. The fill is coloured by pressure and the state is also
 * written out, so the reading never depends on colour alone -- the previous bar
 * used the same accent gradient at 5% used as at 95%.
 */
export function AllowanceMeter({
  window: allowance,
  size = "regular",
}: {
  window: SubscriptionWindow;
  size?: "regular" | "large";
}) {
  const used = Math.round(allowance.usedPercent);
  const pressure = pressureOf(allowance.usedPercent);

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
        aria-valuetext={`${used}% used, ${PRESSURE_LABELS[pressure].toLowerCase()}. ${resetText(allowance.resetsAt)}.`}
      >
        <i style={{ width: `${Math.min(100, Math.max(0, allowance.usedPercent))}%` }} />
      </div>
      <div className="allowance-meta">
        <span>{Math.round(headroom(allowance))}% left · {PRESSURE_LABELS[pressure]}</span>
        <span>{resetText(allowance.resetsAt)}</span>
      </div>
    </div>
  );
}
