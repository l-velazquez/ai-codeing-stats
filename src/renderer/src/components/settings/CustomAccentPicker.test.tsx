import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CustomAccentPicker } from "./CustomAccentPicker";

afterEach(cleanup);

function client(box: DOMRect, xRatio: number, yRatio: number): { clientX: number; clientY: number } {
  return { clientX: box.x + box.width * xRatio, clientY: box.y + box.height * yRatio };
}

function pick(target: Element, xRatio: number, yRatio: number, pointerId: number): void {
  // jsdom has no layout: pin a 100×100 box so the ratios are exact pixels.
  target.getBoundingClientRect = () =>
    ({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }) as DOMRect;
  const box = target.getBoundingClientRect() as DOMRect;
  fireEvent.pointerDown(target, { ...client(box, xRatio, yRatio), pointerId, buttons: 1 });
}

function redOf(hex: string): number { return Number.parseInt(hex.slice(1, 3), 16); }
function blueOf(hex: string): number { return Number.parseInt(hex.slice(5, 7), 16); }

it("starts from the current value and updates from the field, bar, and hex input", () => {
  const picked: string[] = [];
  const view = render(<CustomAccentPicker value="#00c8ff" onChange={(hex) => picked.push(hex)} />);

  // The dot sits at the colour's own saturation/value: #00c8ff is full s, full v.
  const dot = document.querySelector<HTMLElement>(".custom-accent-field .custom-accent-dot")!;
  expect(dot.style.left).toBe("100%");
  expect(dot.style.top).toBe("0%");

  // A pointer press inside the field picks that saturation/value, keeping hue.
  const field = document.querySelector(".custom-accent-field")!;
  pick(field, 0.5, 0.5, 1);
  expect(picked).toHaveLength(1);
  expect(blueOf(picked[0])).toBeGreaterThan(redOf(picked[0]));

  // The hue bar moves the hue while keeping the picked saturation/value.
  const bar = document.querySelector(".custom-accent-hue")!;
  pick(bar, 0.08, 0.5, 2);
  expect(picked).toHaveLength(2);
  expect(redOf(picked[1])).toBeGreaterThan(blueOf(picked[1]));

  // A complete hex applies immediately; garbage changes nothing.
  const input = screen.getByLabelText("Hex") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "#ff2d55" } });
  expect(picked[2]).toBe("#ff2d55");
  expect(picked).toHaveLength(3);
  fireEvent.change(input, { target: { value: "#ab" } });
  expect(picked).toHaveLength(3);

  view.unmount();
});

it("keeps the hue when the value passes through grey", () => {
  const picked: string[] = [];
  const view = render(<CustomAccentPicker value="#00c8ff" onChange={(hex) => picked.push(hex)} />);
  const field = document.querySelector(".custom-accent-field")!;

  // Bottom-left corner: no saturation, no value — pure black, no hue in the hex.
  pick(field, 0, 1, 3);
  expect(picked[0]).toBe("#000000");

  // Dragging back out must not snap to red (hue 0); the cyan hue survived the
  // grey detour.
  pick(field, 0.5, 0.5, 4);
  expect(blueOf(picked[1])).toBeGreaterThan(redOf(picked[1]));

  view.unmount();
});
