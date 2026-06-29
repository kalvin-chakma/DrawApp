import type { Point } from "./types";

export function isInsideEraser(
  p: Point,
  center: Point,
  radius: number,
): boolean {
  return Math.hypot(p.x - center.x, p.y - center.y) <= radius;
}

export function pointToSegmentDistance(
  p: Point,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}


export function segmentCircleIntersections(
  a: Point,
  b: Point,
  center: Point,
  radius: number,
): number[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;

  const A = dx * dx + dy * dy;
  if (A === 0) return [];

  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radius * radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];

  const sqrtDisc = Math.sqrt(disc);
  const eps = 1e-9;
  const ts: number[] = [];
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);
  if (t1 > eps && t1 < 1 - eps) ts.push(t1);
  if (t2 > eps && t2 < 1 - eps && t2 - t1 > eps) ts.push(t2);
  return ts;
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}
