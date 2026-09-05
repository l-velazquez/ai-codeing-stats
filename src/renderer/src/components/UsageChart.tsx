import { useMemo, useRef, useState } from "react";
import type { DailyPoint, Provider } from "@shared/types";
import { money, shortDate } from "@renderer/format";

const HEIGHT = 258;
const TOP = 16;
const BOTTOM = 26;
const LEFT = 4;

const STACK: readonly Provider[] = ["codex", "claude", "opencode"];

/** A "nice" axis ceiling: 1, 2 or 5 times a power of ten above the peak. */
function niceCeiling(peak: number): number {
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  for (const step of [1, 2, 5, 10]) {
    if (peak <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

export function UsageChart({ data }: { data: DailyPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(920);

  const chart = useMemo(() => {
    const peak = Math.max(...data.map((item) => item.cost), 0);
    const ceiling = niceCeiling(peak);
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const inner = Math.max(1, width - LEFT * 2);
    // Daily cost is a discrete series: one reading per day, with nothing in
    // between. The previous spline invented curves through values that were
    // never measured, so this uses columns instead.
    const slot = inner / Math.max(1, data.length);
    const barWidth = Math.max(1, Math.min(18, slot * 0.62));

    const bars = data.map((item, index) => {
      const x = LEFT + slot * index + slot / 2;
      const segments: { provider: Provider; y: number; height: number }[] = [];
      let cursor = 0;
      for (const provider of STACK) {
        const value = item.byProvider[provider] ?? 0;
        if (value <= 0) continue;
        const height = (value / ceiling) * plotHeight;
        cursor += height;
        segments.push({ provider, y: TOP + plotHeight - cursor, height });
      }
      return { x, segments, total: item.cost };
    });

    return { ceiling, bars, slot, barWidth, plotHeight };
  }, [data, width]);

  const hoverBar = hover === null ? null : chart.bars[hover];
  const hoverData = hover === null ? null : data[hover];

  return (
    <div
      className="usage-chart"
      ref={(node) => {
        container.current = node;
        if (node) setWidth(node.clientWidth || 920);
      }}
      onMouseMove={(event) => {
        const bounds = container.current?.getBoundingClientRect();
        if (!bounds || data.length === 0) return;
        const offset = event.clientX - bounds.left - LEFT;
        const index = Math.floor(offset / chart.slot);
        setHover(index >= 0 && index < data.length ? index : null);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div className="chart-axis">
        {[1, 0.5, 0].map((fraction) => (
          <span key={fraction} style={{ top: `${(1 - fraction) * 84 + 2}%` }}>
            {money(chart.ceiling * fraction)}
          </span>
        ))}
      </div>

      {/* No preserveAspectRatio="none": stretching the viewBox distorted every
          stroke, which the old code had to patch with vector-effect on each
          stroked class. */}
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Daily API-equivalent cost by provider. Peak ${money(chart.ceiling)}.`}
      >
        {[TOP, TOP + chart.plotHeight / 2, TOP + chart.plotHeight].map((y) => (
          <line className="chart-grid" key={y} x1="0" x2={width} y1={y} y2={y} />
        ))}

        {hoverBar ? (
          <rect
            className="chart-hover-slot"
            x={hoverBar.x - chart.slot / 2}
            y={TOP}
            width={chart.slot}
            height={chart.plotHeight}
          />
        ) : null}

        {chart.bars.map((bar, index) => (
          <g key={index}>
            {bar.segments.map((segment) => (
              <rect
                key={segment.provider}
                className={`chart-bar chart-bar--${segment.provider}`}
                x={bar.x - chart.barWidth / 2}
                y={segment.y}
                width={chart.barWidth}
                height={Math.max(segment.height, bar.total > 0 ? 1 : 0)}
                rx={Math.min(2, chart.barWidth / 3)}
              />
            ))}
          </g>
        ))}
      </svg>

      <div className="chart-dates">
        <span>{data[0] ? shortDate(Date.parse(data[0].date)) : ""}</span>
        <span>{data.at(-1) ? shortDate(Date.parse(data.at(-1)?.date ?? "")) : ""}</span>
      </div>

      {hoverData && hoverBar ? (
        <div
          className="chart-tooltip"
          style={{ left: `${Math.min(88, Math.max(6, (hoverBar.x / width) * 100))}%` }}
        >
          <span>{shortDate(Date.parse(hoverData.date))}</span>
          <strong>{money(hoverData.cost)}</strong>
          <small>{hoverData.sessions} sessions</small>
        </div>
      ) : null}

      {data.length === 0 ? <p className="chart-empty">No recorded usage in this range</p> : null}
    </div>
  );
}
