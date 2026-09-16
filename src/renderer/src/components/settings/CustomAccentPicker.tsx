import { useEffect, useRef, useState } from "react";
import { customAccentVars, hexToHsv, hsvToHex, normalizeHexColor } from "@shared/settings";
import { BrandMark } from "@renderer/components/BrandMark";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Pointer capture keeps a drag alive outside the element; a synthetic or
 * already-released pointer has nothing to capture, and that is fine. */
function capture(event: React.PointerEvent): void {
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* drag locally instead */ }
}

/**
 * A saturation/value field plus a hue bar: every colour the model can express.
 * The hue lives in local state because a grey has no hue to recover from its
 * hex, and losing it while adjusting lightness would snap the theme to red.
 */
export function CustomAccentPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hue, setHue] = useState(() => hexToHsv(normalizeHexColor(value)).h);
  const [text, setText] = useState(value);
  const field = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const { s, v } = hexToHsv(normalizeHexColor(value));
  const roles = customAccentVars(value);

  useEffect(() => { setText(value); }, [value]);

  const pickField = (event: React.PointerEvent) => {
    const rect = field.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(hsvToHex(hue, clamp01((event.clientX - rect.left) / rect.width), 1 - clamp01((event.clientY - rect.top) / rect.height)));
  };

  const pickHue = (event: React.PointerEvent) => {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect) return;
    const next = clamp01((event.clientX - rect.left) / rect.width) * 360;
    setHue(next);
    onChange(hsvToHex(next, s, v));
  };

  const commitText = (raw: string) => {
    const hex = normalizeHexColor(raw, "");
    if (hex) {
      const picked = hexToHsv(hex);
      if (picked.s > 0) setHue(picked.h);
      onChange(hex);
    }
  };

  return (
    <div className="custom-accent" role="group" aria-label="Custom color">
      <div
        ref={field}
        className="custom-accent-field"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hue, 1, 1)})` }}
        onPointerDown={(event) => { capture(event); pickField(event); }}
        onPointerMove={(event) => { if (event.buttons & 1) pickField(event); }}
      >
        <span className="custom-accent-dot" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: value }} />
      </div>
      <div className="custom-accent-side">
        <div
          ref={bar}
          className="custom-accent-hue"
          onPointerDown={(event) => { capture(event); pickHue(event); }}
          onPointerMove={(event) => { if (event.buttons & 1) pickHue(event); }}
        >
          <span className="custom-accent-dot" style={{ left: `${(hue / 360) * 100}%`, background: hsvToHex(hue, 1, 1) }} />
        </div>
        <div className="custom-accent-preview" style={{ background: `linear-gradient(145deg, ${roles["--brand-start"]}, ${roles["--brand-end"]})` }}>
          <BrandMark size={30} />
        </div>
        <div className="custom-accent-hex">
          <label htmlFor="custom-accent-input">Hex</label>
          <input
            id="custom-accent-input"
            value={text}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => { setText(event.target.value); commitText(event.target.value); }}
          />
        </div>
      </div>
    </div>
  );
}
