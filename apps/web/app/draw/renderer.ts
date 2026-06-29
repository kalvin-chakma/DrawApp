import type { Point, Stroke, ViewTransform, Ref, LineVariant } from "./types";

export interface Renderer {
  applyTransform(): void;
  screenToWorld(sx: number, sy: number): Point;
  getMousePos(e: MouseEvent): Point;
  drawStroke(stroke: Stroke): void;
  redraw(): void;
  drawSegment(from: Point, to: Point, color: string, lineWidth: number): void;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  viewTransformRef: Ref<ViewTransform>,
  strokes: Stroke[],
): Renderer {
  function drawArrowhead(from: Point, to: Point, lineWidth: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 1) return;

    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(12, lineWidth * 5);
    const headAngle = Math.PI / 6; // 30 °

    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - headAngle),
      to.y - headLen * Math.sin(angle - headAngle),
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + headAngle),
      to.y - headLen * Math.sin(angle + headAngle),
    );
    ctx.stroke();
    ctx.restore();
  }


  function applyTransform(): void {
    const { tx, ty, scale } = viewTransformRef.current;
    ctx.setTransform(scale, 0, 0, scale, tx, ty);
  }


  function screenToWorld(sx: number, sy: number): Point {
    const { tx, ty, scale } = viewTransformRef.current;
    return { x: (sx - tx) / scale, y: (sy - ty) / scale };
  }

  function getMousePos(e: MouseEvent): Point {
    return screenToWorld(e.clientX, e.clientY);
  }

  function drawStroke(stroke: Stroke): void {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.type === "pencil") {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
      }
      ctx.stroke();
    } else if (stroke.type === "rect") {
      if (stroke.points.length < 2) return;
      const p1 = stroke.points[0]!;
      const p2 = stroke.points[1]!;
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (stroke.type === "circle") {
      if (stroke.points.length < 2) return;
      const p1 = stroke.points[0]!;
      const p2 = stroke.points[1]!;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      if (rx < 0.5 || ry < 0.5) return;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stroke.type === "line") {
      if (stroke.points.length < 2) return;
      const p1 = stroke.points[0]!;
      const p2 = stroke.points[1]!;
      const variant: LineVariant = stroke.lineVariant ?? "solid";
      const isDashed = variant === "dashed" || variant === "dashed-arrow";
      const hasArrow = variant === "arrow" || variant === "dashed-arrow";

      ctx.save();
      if (isDashed) {
        const dl = Math.max(6, stroke.lineWidth * 4);
        const gl = Math.max(4, stroke.lineWidth * 2.5);
        ctx.setLineDash([dl, gl]);
      }
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();

      if (hasArrow) drawArrowhead(p1, p2, stroke.lineWidth);
    }
  }

  function redraw(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTransform();
    for (const stroke of strokes) {
      drawStroke(stroke);
    }
  }

  function drawSegment(
    from: Point,
    to: Point,
    color: string,
    lineWidth: number,
  ): void {
    applyTransform();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  return {
    applyTransform,
    screenToWorld,
    getMousePos,
    drawStroke,
    redraw,
    drawSegment,
  };
}
