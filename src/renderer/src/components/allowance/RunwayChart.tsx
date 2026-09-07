import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { SubscriptionWindow } from "@shared/types";
import type { Runway } from "@renderer/lib/runway";
import { clockTime } from "@renderer/format";

const HEIGHT = 132;
const TOP = 14;
const BOTTOM = 24;
const PLOT = HEIGHT - TOP - BOTTOM;

/**
 * Allowance against time, across one window.
 *
 * There is exactly one measured reading, so the chart shows exactly one: the
 * solid line is the average pace that got us here, and everything past the dot
 * is drawn dashed because it is arithmetic, not data. A dial or an arc would
 * imply a continuous series the app has never recorded.
 */
export function RunwayChart({
  window: allowance,
  runway,
  now,
}: {
  window: SubscriptionWindow;
  runway: Runway;
  now: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = host.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const windowMs = allowance.windowMinutes * 60_000;
  const x = (at: number) => ((at - runway.startedAt) / windowMs) * width;
  const y = (percent: number) => TOP + PLOT * (1 - Math.min(1, Math.max(0, percent / 100)));

  const baseline = TOP + PLOT;
  const limit = y(100);
  const xNow = x(now);
  const yNow = y(allowance.usedPercent);
  const xEnd = runway.exhaustsAt === null ? width : x(runway.exhaustsAt);
  const yEnd = runway.exhaustsAt === null ? y(runway.projectedPercent) : limit;

  const draw = reduceMotion
    ? {}
    : {
        initial: { x2: xNow, y2: yNow },
        animate: { x2: xEnd, y2: yEnd },
        transition: { duration: 0.55, ease: "easeOut" as const, delay: 0.12 },
      };

  return (
    <div className="runway-chart" ref={host}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Allowance against time. ${Math.round(allowance.usedPercent)}% used ${
          Math.round(runway.elapsedFraction * 100)
        }% of the way through the window, tracking towards ${Math.round(runway.projectedPercent)}% by the reset.`}
      >
        <line className="runway-limit" x1="0" x2={width} y1={limit} y2={limit} />
        <text className="runway-limit-label" x="0" y={limit - 7}>100% used</text>
        <line className="runway-base" x1="0" x2={width} y1={baseline} y2={baseline} />

        <path className="runway-area" d={`M 0 ${baseline} L ${xNow} ${yNow} L ${xNow} ${baseline} Z`} />
        <line className="runway-measured" x1="0" y1={baseline} x2={xNow} y2={yNow} />
        <motion.line className="runway-projected" x1={xNow} y1={yNow} x2={xEnd} y2={yEnd} {...draw} />

        <line className="runway-now" x1={xNow} x2={xNow} y1={yNow} y2={baseline} />
        <circle className="runway-point" cx={xNow} cy={yNow} r="4" />

        {runway.exhaustsAt === null ? null : (
          <motion.g
            className="runway-cross"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.62 }}
          >
            <line x1={xEnd - 5} y1={limit - 5} x2={xEnd + 5} y2={limit + 5} />
            <line x1={xEnd - 5} y1={limit + 5} x2={xEnd + 5} y2={limit - 5} />
          </motion.g>
        )}
      </svg>

      <div className="runway-axis">
        <span>{clockTime(runway.startedAt, now)}</span>
        <span>{clockTime(allowance.resetsAt, now)} reset</span>
      </div>
    </div>
  );
}
