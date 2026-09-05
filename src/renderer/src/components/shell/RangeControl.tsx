import type { RangeKey } from "../../../../shared/types";

export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

const ORDER: readonly RangeKey[] = ["7d", "30d", "90d", "all"];

export function RangeControl({
  range,
  onChange,
}: {
  range: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  return (
    <div className="range-control" role="group" aria-label="Date range">
      {ORDER.map((key) => (
        <button
          key={key}
          className={range === key ? "active" : ""}
          onClick={() => onChange(key)}
          aria-pressed={range === key}
        >
          {key === "all" ? "All" : key.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
