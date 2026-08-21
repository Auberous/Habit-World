// Small polar/SVG-arc math helpers shared by the orbit renderer.

export type Point = { x: number; y: number };

export function polarToCartesian(cx: number, cy: number, r: number, angle: number): Point {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/**
 * SVG path `d` for an arc of a circle centered at (cx, cy) with radius r,
 * spanning from startAngle to endAngle (radians, clockwise-positive since
 * screen y grows downward).
 */
export function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const sweep = endAngle - startAngle;
  const largeArcFlag = Math.abs(sweep) % (Math.PI * 2) > Math.PI ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

export const TAU = Math.PI * 2;

export function normalizeAngle(angle: number): number {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}
