import { useMemo, useRef, useState } from "react";
import type { DailyPoint } from "../../../shared/types";
import { money, shortDate } from "../format";

const WIDTH = 920;
const HEIGHT = 258;
const TOP = 16;
const BOTTOM = 26;

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]?.x},${points[0]?.y}`;
  let path = `M${points[0]?.x.toFixed(2)},${points[0]?.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    if (!current || !previous) continue;
    const previousPrevious = points[i - 2] ?? previous;
    const next = points[i + 1] ?? current;
    const c1x = previous.x + (current.x - previousPrevious.x) / 6;
    const c1y = previous.y + (current.y - previousPrevious.y) / 6;
    const c2x = current.x - (next.x - previous.x) / 6;
    const c2y = current.y - (next.y - previous.y) / 6;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${current.x.toFixed(2)},${current.y.toFixed(2)}`;
  }
  return path;
}

export function UsageChart({ data }: { data: DailyPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const chart = useMemo(() => {
    const peak = Math.max(0.01, ...data.map((item) => item.cost));
    const nicePeak = Math.ceil(peak / 5) * 5 || peak;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const step = data.length > 1 ? WIDTH / (data.length - 1) : WIDTH;
    const points = data.map((item, index) => ({
      x: index * step,
      y: TOP + plotHeight - (item.cost / nicePeak) * plotHeight,
    }));
    const line = smoothPath(points);
    const area = line ? `${line} L${WIDTH},${HEIGHT - BOTTOM} L0,${HEIGHT - BOTTOM} Z` : "";
    return { peak: nicePeak, points, line, area };
  }, [data]);

  const hoverPoint = hover === null ? null : chart.points[hover];
  const hoverData = hover === null ? null : data[hover];

  return (
    <div
      className="usage-chart"
      ref={container}
      onMouseMove={(event) => {
        const bounds = container.current?.getBoundingClientRect();
        if (!bounds || data.length === 0) return;
        const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        setHover(Math.round(ratio * (data.length - 1)));
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div className="chart-axis">
        {[1, 0.5, 0].map((fraction) => (
          <span key={fraction} style={{ top: `${(1 - fraction) * 84 + 2}%` }}>
            {money(chart.peak * fraction)}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Daily API-equivalent cost">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart)" stopOpacity=".28" />
            <stop offset=".65" stopColor="var(--chart)" stopOpacity=".06" />
            <stop offset="1" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[TOP, TOP + (HEIGHT - TOP - BOTTOM) / 2, HEIGHT - BOTTOM].map((y) => (
          <line className="chart-grid" key={y} x1="0" x2={WIDTH} y1={y} y2={y} />
        ))}
        <path d={chart.area} fill="url(#chart-fill)" />
        <path className="chart-line-glow" d={chart.line} />
        <path className="chart-line" d={chart.line} />
        {hoverPoint ? (
          <>
            <line className="chart-hover-line" x1={hoverPoint.x} x2={hoverPoint.x} y1={TOP} y2={HEIGHT - BOTTOM} />
            <circle className="chart-hover-ring" cx={hoverPoint.x} cy={hoverPoint.y} r="7" />
            <circle className="chart-hover-dot" cx={hoverPoint.x} cy={hoverPoint.y} r="3.5" />
          </>
        ) : null}
      </svg>
      <div className="chart-dates">
        <span>{data[0] ? shortDate(Date.parse(data[0].date)) : ""}</span>
        <span>{data.at(-1) ? shortDate(Date.parse(data.at(-1)?.date ?? "")) : ""}</span>
      </div>
      {hoverData && hoverPoint ? (
        <div className="chart-tooltip" style={{ left: `${(hoverPoint.x / WIDTH) * 100}%` }}>
          <span>{shortDate(Date.parse(hoverData.date))}</span>
          <strong>{money(hoverData.cost)}</strong>
          <small>{hoverData.sessions} sessions</small>
        </div>
      ) : null}
    </div>
  );
}
