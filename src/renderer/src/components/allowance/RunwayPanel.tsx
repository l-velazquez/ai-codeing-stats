import { ChevronRight } from "lucide-react";
import type { SubscriptionUsage, SubscriptionWindow } from "@shared/types";
import { allowanceIsStale } from "@shared/menuBar";
import { PROVIDERS, clockTime, duration, relative } from "@renderer/format";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { AllowanceMeter } from "@renderer/components/allowance/AllowanceMeter";
import { RunwayChart } from "@renderer/components/allowance/RunwayChart";
import { headroom, isLive, leadAllowance, pressureFor } from "@renderer/lib/allowance";
import { runwayFor } from "@renderer/lib/runway";
import { windowAfterReset } from "@shared/allowance";

interface Reading {
  readonly usage: SubscriptionUsage;
  readonly window: SubscriptionWindow;
}

/** The headline figure and the sentence under it, for one reading. */
function copyFor(reading: Reading, now: number): { figure: string; sentence: string } {
  const { usage, window: allowance } = reading;
  const left = Math.round(headroom(allowance, now));
  const resets = clockTime(allowance.resetsAt, now);
  const projection = runwayFor(allowance, now);
  const stale = allowanceIsStale(usage, allowance, now);

  if (allowance.resetsAt <= now) {
    return {
      figure: "Allowance reset",
      sentence: `This window reset at ${resets}. The bar was reset automatically from that known time.`,
    };
  }
  if (left <= 0) {
    return { figure: "Allowance spent", sentence: `Nothing left in this window. Resets at ${resets}.` };
  }
  if (stale && usage.updatedAt !== null) {
    return {
      figure: `${left}% left`,
      sentence: `${PROVIDERS[usage.provider].label} last reported this ${relative(usage.updatedAt)} ago, so the pace behind it may have moved.`,
    };
  }
  if (projection === null) {
    return {
      figure: `${left}% left`,
      sentence: "Too early in this window to read a pace.",
    };
  }
  if (projection.survivesWindow) {
    return {
      figure: "Clear to the reset",
      sentence: `${left}% left. On this pace you finish around ${Math.round(projection.projectedPercent)}% used when it resets at ${resets}.`,
    };
  }
  const exhaustsAt = projection.exhaustsAt ?? allowance.resetsAt;
  return {
    figure: `${duration(now, now + projection.runwayMs)} of runway`,
    sentence: `${left}% left. On this pace you hit the limit at ${clockTime(exhaustsAt, now)}, ${duration(exhaustsAt, allowance.resetsAt)} before it resets at ${resets}.`,
  };
}

/**
 * What the home screen opens on, because the question worth asking before
 * starting a long session is how much longer the agent will keep answering --
 * not what last month cost, and not a bare percentage. A percentage cannot
 * distinguish 62% spent steadily over four hours from 62% spent in the last
 * twenty minutes; a pace can, so the headline is a duration.
 *
 * Allowance is independent of the selected range, and the copy says so rather
 * than letting the range control imply otherwise.
 */
export function RunwayPanel({
  subscriptions,
  onOpenDetail,
  now = Date.now(),
}: {
  subscriptions: readonly SubscriptionUsage[];
  onOpenDetail: () => void;
  now?: number;
}) {
  const lead = leadAllowance(subscriptions, now);
  if (!lead) return null;

  const projection = runwayFor(lead.window, now);
  const stale = allowanceIsStale(lead.usage, lead.window, now);
  const { figure, sentence } = copyFor(lead, now);
  const pressure = pressureFor(lead.window, now);

  const others = subscriptions
    .filter(isLive)
    .flatMap((usage) => usage.windows.map((window) => ({ usage, window: windowAfterReset(window, now) })))
    .filter(({ usage, window }) =>
      `${usage.provider}:${window.label}:${window.windowMinutes}` !==
      `${lead.usage.provider}:${lead.window.label}:${lead.window.windowMinutes}`,
    );

  return (
    <section className="panel panel--raised runway" data-pressure={pressure}>
      <header className="runway-head">
        <div className="runway-identity">
          <ProviderMark provider={lead.usage.provider} />
          <div>
            <strong>{PROVIDERS[lead.usage.provider].label}</strong>
            <span>
              {lead.window.label}
              {lead.usage.plan ? ` · ${lead.usage.plan} plan` : ""}
            </span>
          </div>
        </div>
        <button className="text-action" onClick={onOpenDetail}>
          Allowance detail <ChevronRight size={13} />
        </button>
      </header>

      <div className="runway-figure">{figure}</div>
      <p className="runway-sentence">{sentence}</p>

      {projection && !stale ? (
        <RunwayChart window={lead.window} runway={projection} now={now} />
      ) : (
        <AllowanceMeter window={lead.window} size="large" />
      )}

      {others.length > 0 ? (
        <div className="runway-others well">
          {others.map(({ usage, window: allowance }) => (
            <button
              key={`${usage.provider}:${allowance.label}`}
              className="runway-other"
              onClick={onOpenDetail}
              data-pressure={pressureFor(allowance, now)}
            >
              <ProviderMark provider={usage.provider} small />
              <span>{PROVIDERS[usage.provider].label}</span>
              <small>{allowance.label}</small>
              <strong>{Math.round(headroom(allowance, now))}% left</strong>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
