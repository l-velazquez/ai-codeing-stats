interface Rect { x: number; y: number; width: number; height: number }

/** All coordinates are display-independent pixels, including negative displays. */
export function panelBounds(anchor: Rect, area: Rect, width = 360, height = 620): Rect {
  width = Math.min(width, area.width);
  height = Math.min(height, area.height);
  return {
    width, height,
    x: Math.round(Math.max(area.x, Math.min(anchor.x + anchor.width / 2 - width / 2, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(anchor.y + anchor.height + 6, area.y + area.height - height))),
  };
}
