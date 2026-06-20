// lib/draw.ts

interface DrawEvent {
  type: "draw_start" | "draw_move" | "draw_end" | "erase_partial";
  roomId: string;
  x: number;
  y: number;
  color?: string;
  lineWidth?: number;
  strokeId?: number;
  // Partial-erase fields
  erasedId?: number;
  replacements?: Array<{
    id: number;
    points: Point[];
    color: string;
    lineWidth: number;
  }>;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: number;
  points: Point[];
  color: string;
  lineWidth: number;
}

interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

// A plain mutable ref — no React dependency needed at runtime.
interface Ref<T> {
  current: T;
}

export function initDraw(
  canvas: HTMLCanvasElement,
  roomId: string,
  socket: WebSocket | null | undefined,
  selectedToolRef: Ref<string>,
  colorRef: Ref<string>,
  lineWidthRef: Ref<number>,
  viewTransformRef: Ref<ViewTransform>,
  eraserSizeRef: Ref<number>,
): { cleanup: () => void; redraw: () => void } {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    console.error("Failed to get 2D context from canvas");
    return { cleanup: () => {}, redraw: () => {} };
  }
  // Assign to a non-nullable const so TypeScript preserves the type inside closures.
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // All strokes stored in world-space coordinates.
  const strokes: Stroke[] = [];
  let currentStroke: Stroke | null = null;
  let otherUserCurrentStroke: Stroke | null = null;

  // Random seed minimises cross-client ID collisions without a server round-trip.
  let nextStrokeId = Math.floor(Math.random() * 1e9);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  /**
   * Apply the current view transform to the 2D context so that all subsequent
   * draw calls operate in world space.
   */
  function applyTransform(): void {
    const { tx, ty, scale } = viewTransformRef.current;
    ctx.setTransform(scale, 0, 0, scale, tx, ty);
  }

  /**
   * Convert a screen (viewport) coordinate to a world coordinate using the
   * inverse of the current view transform.
   */
  function screenToWorld(sx: number, sy: number): Point {
    const { tx, ty, scale } = viewTransformRef.current;
    return { x: (sx - tx) / scale, y: (sy - ty) / scale };
  }

  /**
   * Get the current mouse position in world coordinates.
   * The canvas covers the full viewport at (0,0) with no CSS transform, so
   * clientX/clientY map directly to screen pixels.
   */
  function getMousePos(e: MouseEvent): Point {
    return screenToWorld(e.clientX, e.clientY);
  }

  // ── Full redraw ─────────────────────────────────────────────────────────────

  /**
   * Clear the canvas and repaint all stored strokes using the current view
   * transform.  Called whenever the view changes (pan / zoom) or after erasing.
   */
  function redraw(): void {
    // Reset to identity so clearRect covers the whole canvas buffer.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    applyTransform();

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
      }
      ctx.stroke();
    }
  }

  // ── Incremental draw helper ─────────────────────────────────────────────────

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

  // ── Eraser geometry ─────────────────────────────────────────────────────────

  /**
   * The eraser radius in world-space.  `eraserSizeRef.current` is a
   * screen-pixel radius so dividing by scale keeps the circle visually
   * consistent at any zoom level.
   */
  function getEraserWorldRadius(): number {
    return eraserSizeRef.current / viewTransformRef.current.scale;
  }

  /** True when point p is strictly inside (or on the boundary of) the eraser circle. */
  function isInsideEraser(p: Point, center: Point, radius: number): boolean {
    return Math.hypot(p.x - center.x, p.y - center.y) <= radius;
  }

  /**
   * Find t-parameters in (0, 1) where the segment A→B crosses the eraser
   * circle boundary.  Returns 0, 1, or 2 values in ascending order.
   */
  function segmentCircleIntersections(
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
    if (A === 0) return []; // zero-length segment

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

  function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }

  /**
   * Minimum distance from point p to segment A→B (used for initial hit check).
   */
  function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
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

  /** Quick check — true if any part of the stroke is within the eraser circle. */
  function strokeIntersectsEraser(
    stroke: Stroke,
    center: Point,
    radius: number,
  ): boolean {
    const pts = stroke.points;
    if (pts.length === 0) return false;
    if (pts.length === 1) {
      return isInsideEraser(pts[0]!, center, radius);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (pointToSegmentDistance(center, pts[i]!, pts[i + 1]!) <= radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Split a stroke around the eraser circle.
   *
   * The algorithm walks every consecutive point pair (segment).  For each
   * segment it determines which endpoint(s) are inside the circle and where
   * the segment crosses the circle boundary, then builds the surviving
   * sub-strokes from the outside portions.
   *
   * Returns an array of new Stroke objects (may be empty if the stroke was
   * fully covered).
   */
  function splitStrokeByEraser(
    stroke: Stroke,
    center: Point,
    radius: number,
  ): Stroke[] {
    const pts = stroke.points;
    if (pts.length === 0) return [];

    const result: Stroke[] = [];
    let currentPoints: Point[] = [];

    function finishSubStroke(): void {
      if (currentPoints.length >= 2) {
        result.push({
          id: nextStrokeId++,
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
          // Cap the current sub-stroke at the entry point, then immediately
          // start a new one from the exit point.
          currentPoints.push(lerp(a, b, ts[0]!));
          finishSubStroke();
          currentPoints.push(lerp(a, b, ts[1]!));
        }
        // Whether or not it threaded, B is outside — add it.
        currentPoints.push(b);
      } else if (!aIn && bIn) {
        // Crossing into the circle — cap sub-stroke at the entry boundary.
        if (ts.length > 0) currentPoints.push(lerp(a, b, ts[0]!));
        finishSubStroke();
        // B is inside — don't add it.
      } else if (aIn && !bIn) {
        // Crossing out of the circle — start a new sub-stroke at the exit boundary.
        if (ts.length > 0) currentPoints.push(lerp(a, b, ts[ts.length - 1]!));
        currentPoints.push(b);
      }
      // aIn && bIn → entirely inside, skip both.
    }

    finishSubStroke();
    return result;
  }

  /**
   * For every stroke that intersects the eraser circle:
   *   1. Compute surviving sub-strokes via `splitStrokeByEraser`.
   *   2. Replace the original stroke with the survivors in-place.
   *   3. Broadcast an `erase_partial` event so remote clients stay in sync.
   *
   * A single `redraw()` is called at the end if anything changed.
   */
  function eraseAt(center: Point): void {
    const radius = getEraserWorldRadius();
    let changed = false;

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i]!;
      if (!strokeIntersectsEraser(stroke, center, radius)) continue;

      const survivors = splitStrokeByEraser(stroke, center, radius);

      // Replace in-place so relative stroke order is preserved for rendering.
      strokes.splice(i, 1, ...survivors);
      changed = true;

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "erase_partial",
            roomId,
            x: center.x,
            y: center.y,
            erasedId: stroke.id,
            replacements: survivors.map((s) => ({
              id: s.id,
              points: s.points,
              color: s.color,
              lineWidth: s.lineWidth,
            })),
          }),
        );
      }
    }

    if (changed) redraw();
  }

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  let isDrawing = false;
  let isErasing = false;
  let lastPoint: Point | null = null;

  function handleMouseDown(e: MouseEvent): void {
    const tool = selectedToolRef.current;
    const point = getMousePos(e);

    if (tool === "pencil") {
      isDrawing = true;
      lastPoint = point;

      const color = colorRef.current;
      const lineWidth = lineWidthRef.current;
      const strokeId = nextStrokeId++;

      currentStroke = { id: strokeId, points: [point], color, lineWidth };
      strokes.push(currentStroke);

      if (socket && socket.readyState === WebSocket.OPEN) {
        const event: DrawEvent = {
          type: "draw_start",
          roomId,
          x: point.x,
          y: point.y,
          color,
          lineWidth,
          strokeId,
        };
        socket.send(JSON.stringify(event));
      }
    } else if (tool === "eraser") {
      isErasing = true;
      eraseAt(point);
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (isDrawing && lastPoint && currentStroke) {
      const point = getMousePos(e);
      currentStroke.points.push(point);

      // Draw only the new segment for smooth real-time performance.
      drawSegment(
        lastPoint,
        point,
        currentStroke.color,
        currentStroke.lineWidth,
      );

      if (socket && socket.readyState === WebSocket.OPEN) {
        const event: DrawEvent = {
          type: "draw_move",
          roomId,
          x: point.x,
          y: point.y,
        };
        socket.send(JSON.stringify(event));
      }

      lastPoint = point;
    } else if (isErasing) {
      eraseAt(getMousePos(e));
    }
  }

  function handleMouseUp(e: MouseEvent): void {
    if (isDrawing) {
      isDrawing = false;
      currentStroke = null;
      const point = getMousePos(e);
      lastPoint = null;

      if (socket && socket.readyState === WebSocket.OPEN) {
        const event: DrawEvent = {
          type: "draw_end",
          roomId,
          x: point.x,
          y: point.y,
        };
        socket.send(JSON.stringify(event));
      }
    }

    if (isErasing) {
      isErasing = false;
    }
  }

  // ── WebSocket handler ───────────────────────────────────────────────────────

  function handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as DrawEvent & { roomId: string };

      if (data.type === "draw_start" && data.roomId === roomId) {
        const pt = { x: data.x, y: data.y };
        otherUserCurrentStroke = {
          id: data.strokeId ?? nextStrokeId++,
          points: [pt],
          color: data.color ?? "#ff0000",
          lineWidth: data.lineWidth ?? 2,
        };
        strokes.push(otherUserCurrentStroke);
      } else if (
        data.type === "draw_move" &&
        data.roomId === roomId &&
        otherUserCurrentStroke
      ) {
        const prev =
          otherUserCurrentStroke.points[
            otherUserCurrentStroke.points.length - 1
          ]!;
        const cur = { x: data.x, y: data.y };
        otherUserCurrentStroke.points.push(cur);
        drawSegment(
          prev,
          cur,
          otherUserCurrentStroke.color,
          otherUserCurrentStroke.lineWidth,
        );
      } else if (data.type === "draw_end" && data.roomId === roomId) {
        otherUserCurrentStroke = null;
      } else if (
        data.type === "erase_partial" &&
        data.roomId === roomId &&
        data.erasedId !== undefined &&
        data.replacements
      ) {
        // Find the original stroke by ID and replace it with the survivors.
        const idx = strokes.findIndex((s) => s.id === data.erasedId);
        if (idx !== -1) {
          const survivors: Stroke[] = data.replacements.map((r) => ({
            id: r.id,
            points: r.points,
            color: r.color,
            lineWidth: r.lineWidth,
          }));
          strokes.splice(idx, 1, ...survivors);
          redraw();
        }
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  }

  // ── Touch event forwarding ──────────────────────────────────────────────────

  function handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      }),
    );
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY,
      }),
    );
  }

  function handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    canvas.dispatchEvent(new MouseEvent("mouseup", {}));
  }

  // ── Register listeners ──────────────────────────────────────────────────────

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseout", handleMouseUp);
  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);
  if (socket) {
    socket.addEventListener("message", handleWebSocketMessage);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  function cleanup(): void {
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mouseout", handleMouseUp);
    canvas.removeEventListener("touchstart", handleTouchStart);
    canvas.removeEventListener("touchmove", handleTouchMove);
    canvas.removeEventListener("touchend", handleTouchEnd);
    if (socket) {
      socket.removeEventListener("message", handleWebSocketMessage);
    }
  }

  return { cleanup, redraw };
}
