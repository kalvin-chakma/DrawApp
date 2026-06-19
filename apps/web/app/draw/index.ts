// lib/draw.ts

interface DrawEvent {
  type: "draw_start" | "draw_move" | "draw_end";
  roomId: string;
  x: number;
  y: number;
  color?: string;
  lineWidth?: number;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
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
   * transform.  Called whenever the view changes (pan / zoom).
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

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  let isDrawing = false;
  let lastPoint: Point | null = null;

  function handleMouseDown(e: MouseEvent): void {
    if (selectedToolRef.current !== "pencil") return;

    isDrawing = true;
    const point = getMousePos(e);
    lastPoint = point;

    const color = colorRef.current;
    const lineWidth = lineWidthRef.current;

    currentStroke = { points: [point], color, lineWidth };
    strokes.push(currentStroke);

    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: DrawEvent = {
        type: "draw_start",
        roomId,
        x: point.x,
        y: point.y,
        color,
        lineWidth,
      };
      socket.send(JSON.stringify(event));
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDrawing || !lastPoint || !currentStroke) return;

    const point = getMousePos(e);
    currentStroke.points.push(point);

    // Draw only the new segment for smooth real-time performance.
    drawSegment(lastPoint, point, currentStroke.color, currentStroke.lineWidth);

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
  }

  function handleMouseUp(e: MouseEvent): void {
    if (!isDrawing) return;

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

  // ── WebSocket handler ───────────────────────────────────────────────────────

  function handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as DrawEvent & { roomId: string };

      if (data.type === "draw_start" && data.roomId === roomId) {
        const pt = { x: data.x, y: data.y };
        otherUserCurrentStroke = {
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
