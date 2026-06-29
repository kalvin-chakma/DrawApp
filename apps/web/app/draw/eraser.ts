import type { Point, Stroke } from "./types";
import {
  isInsideEraser,
  lerp,
  pointToSegmentDistance,
  segmentCircleIntersections,
} from "./geometry";

export function strokeIntersectsEraser(
  stroke: Stroke,
  center: Point,
  radius: number,
): boolean {
  if (stroke.type === "rect") {
    if (stroke.points.length < 2) return false;
    const p1 = stroke.points[0]!;
    const p2 = stroke.points[1]!;
    const x1 = Math.min(p1.x, p2.x);
    const y1 = Math.min(p1.y, p2.y);
    const x2 = Math.max(p1.x, p2.x);
    const y2 = Math.max(p1.y, p2.y);
    const sides: [Point, Point][] = [
      [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
      ],
      [
        { x: x2, y: y1 },
        { x: x2, y: y2 },
      ],
      [
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
      [
        { x: x1, y: y2 },
        { x: x1, y: y1 },
      ],
    ];
    return sides.some(
      ([a, b]) => pointToSegmentDistance(center, a, b) <= radius,
    );
  }

  if (stroke.type === "circle") {
    if (stroke.points.length < 2) return false;
    const p1 = stroke.points[0]!;
    const p2 = stroke.points[1]!;
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const rx = Math.abs(p2.x - p1.x) / 2;
    const ry = Math.abs(p2.y - p1.y) / 2;
    if (rx < 0.5 || ry < 0.5) return false;
    for (let i = 0; i < 32; i++) {
      const theta = (2 * Math.PI * i) / 32;
      const px = cx + rx * Math.cos(theta);
      const py = cy + ry * Math.sin(theta);
      if (Math.hypot(px - center.x, py - center.y) <= radius) return true;
    }
    return false;
  }

  // line: treat as a single segment hit-test
  if (stroke.type === "line") {
    if (stroke.points.length < 2) return false;
    return (
      pointToSegmentDistance(center, stroke.points[0]!, stroke.points[1]!) <=
      radius
    );
  }

  // pencil
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return isInsideEraser(pts[0]!, center, radius);
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointToSegmentDistance(center, pts[i]!, pts[i + 1]!) <= radius) {
      return true;
    }
  }
  return false;
}

export function splitStrokeByEraser(
  stroke: Stroke,
  center: Point,
  radius: number,
  getNextId: () => number,
): Stroke[] {
  // Shapes and lines are atomic — erase removes the whole thing.
  if (
    stroke.type === "rect" ||
    stroke.type === "circle" ||
    stroke.type === "line"
  )
    return [];

  // Pencil: precise segment-by-segment split.
  const pts = stroke.points;
  if (pts.length === 0) return [];

  const result: Stroke[] = [];
  let currentPoints: Point[] = [];

  function finishSubStroke(): void {
    if (currentPoints.length >= 2) {
      result.push({
        id: getNextId(),
        type: "pencil",
        points: currentPoints,
        color: stroke.color,
        lineWidth: stroke.lineWidth,
      });
    }
    currentPoints = [];
  }

  // Seed the first point if it starts outside the eraser.
  if (!isInsideEraser(pts[0]!, center, radius)) {
    currentPoints.push(pts[0]!);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const aIn = isInsideEraser(a, center, radius);
    const bIn = isInsideEraser(b, center, radius);
    const ts = segmentCircleIntersections(a, b, center, radius);

    if (!aIn && !bIn) {
      if (ts.length === 2) {
        // Segment threads through the circle: outside → inside → outside.
        // Cap the current sub-stroke at the entry, start a new one at exit.
        currentPoints.push(lerp(a, b, ts[0]!));
        finishSubStroke();
        currentPoints.push(lerp(a, b, ts[1]!));
      }
      currentPoints.push(b);
    } else if (!aIn && bIn) {
      // Crossing into the circle — cap sub-stroke at the entry boundary.
      if (ts.length > 0) currentPoints.push(lerp(a, b, ts[0]!));
      finishSubStroke();
    } else if (aIn && !bIn) {
      // Crossing out of the circle — start new sub-stroke at exit boundary.
      if (ts.length > 0) currentPoints.push(lerp(a, b, ts[ts.length - 1]!));
      currentPoints.push(b);
    }
  }

  finishSubStroke();
  return result;
}
