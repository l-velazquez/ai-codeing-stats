interface Rect { x: number; y: number; width: number; height: number }

export const PANEL_WIDTH = 400;
/** Header (52) + the Today block (~166) + footer (~78), floored: the first
 *  "Reading local usage…" frame is never a sliver. */
export const PANEL_MIN_HEIGHT = 300;
export const PANEL_GAP = 6;

/** All coordinates are display-independent pixels, including negative displays. */
export function panelBounds(anchor: Rect, area: Rect, width = PANEL_WIDTH, height = PANEL_MIN_HEIGHT, gap = PANEL_GAP): Rect {
  width = Math.min(width, area.width);
  height = Math.min(height, area.height);
  return {
    width, height,
    x: Math.round(Math.max(area.x, Math.min(anchor.x + anchor.width / 2 - width / 2, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(anchor.y + anchor.height + gap, area.y + area.height - height))),
  };
}

/**
 * Natural content height clamped to the floor and to the room below the tray.
 * Unmeasured content falls back to the floor; content that outgrows the display
 * pins to the available room, which is the only case that leaves a scrollbar.
 */
export function panelHeight(content: number, anchor: Rect, area: Rect,
  min = PANEL_MIN_HEIGHT, gap = PANEL_GAP): number {
  const available = Math.max(0, area.y + area.height - (anchor.y + anchor.height + gap));
  const fit = Math.ceil(content > 0 ? content : min);
  return Math.min(Math.max(min, Math.min(fit, available)), area.height);
}
