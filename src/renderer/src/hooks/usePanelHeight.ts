import { useLayoutEffect, useRef } from "react";

/**
 * True when a newly measured height is worth sending to main. The threshold
 * absorbs sub-pixel font metrics and the relative-time ticker's reflow, both of
 * which would otherwise nudge the window every few seconds.
 */
export function shouldReport(previous: number | null, next: number, threshold = 2): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  return previous === null || Math.abs(next - previous) >= threshold;
}

/**
 * Reports the popover's natural height so main can size the window to it.
 *
 * The three observed elements are measured because their heights are intrinsic:
 * the scroll container itself is `flex: 1`, so its height is derived from the
 * window and measuring it would feed the window's own size back into the answer.
 */
export function usePanelHeight(enabled: boolean) {
  const header = useRef<HTMLElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const nodes = [header.current, measure.current, footer.current].filter((node) => node !== null);
    if (nodes.length < 3) return;
    let sent: number | null = null;
    let pending = false;
    let frame = 0;
    // One rounding on the sum: three rounded heights would drift by up to 3px.
    const report = () => {
      pending = false;
      const next = Math.ceil(nodes.reduce((total, node) => total + node.getBoundingClientRect().height, 0));
      if (!shouldReport(sent, next)) return;
      sent = next;
      window.azulCode?.menuBar.setHeight?.(next);
    };
    // The flag, not the frame id, guards re-entry: the id is only assigned after the
    // callback returns, which is too late if the frame ran synchronously.
    const observer = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(report);
    });
    for (const node of nodes) observer.observe(node);
    report();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return { header, measure, footer };
}
