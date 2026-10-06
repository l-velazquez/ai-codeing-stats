import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { shouldReport, usePanelHeight } from "./usePanelHeight";

// jsdom ships no ResizeObserver, and a global no-op stub would silently disable
// the guard the hook relies on elsewhere, so it is installed only for this file.
const observed: Element[] = [];
let trigger: (() => void) | null = null;
class StubResizeObserver {
  constructor(callback: () => void) { trigger = callback; }
  observe(node: Element) { observed.push(node); }
  disconnect() { trigger = null; }
}

afterEach(() => {
  observed.length = 0;
  trigger = null;
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "azulCode");
});

function setup(heights: [number, number, number]) {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  const setHeight = vi.fn();
  Object.assign(window, { azulCode: { menuBar: { setHeight } } });
  function Panel() {
    const panel = usePanelHeight(true);
    return <div>
      <header ref={panel.header} /><main><div ref={panel.measure} /></main><footer ref={panel.footer} />
    </div>;
  }
  const view = render(<Panel />);
  const nodes = [view.container.querySelector("header")!, view.container.querySelector("main > div")!, view.container.querySelector("footer")!];
  const sizes = new Map<Element, number>(nodes.map((node, index) => [node, heights[index]]));
  for (const node of nodes) {
    node.getBoundingClientRect = () => ({ height: sizes.get(node)! } as DOMRect);
  }
  return { setHeight, sizes, nodes };
}

it("decides which measurements are worth sending", () => {
  expect(shouldReport(null, 0)).toBe(false);
  expect(shouldReport(null, Number.NaN)).toBe(false);
  expect(shouldReport(null, 420)).toBe(true);
  expect(shouldReport(420, 421)).toBe(false);
  expect(shouldReport(420, 423)).toBe(true);
  expect(shouldReport(420, 417)).toBe(true);
});

it("reports the summed natural height once and ignores sub-threshold reflow", () => {
  const { setHeight, sizes, nodes } = setup([52, 400.4, 78]);
  trigger?.();
  expect(setHeight).toHaveBeenCalledExactlyOnceWith(531); // ceil of the sum, not of each part
  setHeight.mockClear();

  sizes.set(nodes[1], 401); // the relative-time ticker nudging a line
  trigger?.();
  expect(setHeight).not.toHaveBeenCalled();

  sizes.set(nodes[1], 440); // a provider row appearing
  trigger?.();
  expect(setHeight).toHaveBeenCalledExactlyOnceWith(570);
});

it("stays inert without a bridge or a ResizeObserver", () => {
  const setHeight = vi.fn();
  Object.assign(window, { azulCode: { menuBar: { setHeight } } });
  function Panel() {
    const panel = usePanelHeight(true);
    return <div><header ref={panel.header} /><div ref={panel.measure} /><footer ref={panel.footer} /></div>;
  }
  expect(() => render(<Panel />)).not.toThrow();
  expect(setHeight).not.toHaveBeenCalled();
});
