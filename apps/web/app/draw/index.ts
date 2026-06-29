interface DrawEvent {
  type: "draw_start" | "draw_move" | "draw_end" | "erase_partial" | "rect_start" | "rect_move" | "rect_end";
  roomId: string;
  x: number;
  y: number;
  color?: string;
  lineWidth?: number;
  strokeId?: number;
  // Rect fields
  x2?: number;
  y2?: number;
  // Partial-erase fields
  erasedId?: number;
  replacements?: Array<{
    id: number;
    points: Point[];
    color: string;
    lineWidth: number;
    kind: "path";
  }>;
}

interface Point {
  x: number;
  y: number;
}

interface PathStroke {
  id: number;
  kind: "path";
  points: Point[];
  color: string;
  lineWidth: number;
}

interface RectStroke {
  id: number;
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  lineWidth: number;
}

type Stroke = PathStroke | RectStroke;

interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

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
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const strokes: Stroke[] = [];
  let currentStroke: PathStroke | null = null;
  let currentRect: RectStroke | null = null;    // live rect being dragged
  let otherUserCurrentStroke: PathStroke | null = null;
  let otherUserCurrentRect: RectStroke | null = null;

  let nextStrokeId = Math.floor(Math.random() * 1e9);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ── Coordinate helpers ──────────────────────────────────────────────────────

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

  // ── Stroke renderers ────────────────────────────────────────────────────────

  function renderStroke(stroke: Stroke): void {
    if (stroke.kind === "path") {
      if (stroke.points.length < 2) return;
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
    } else {
      // rect
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      ctx.strokeRect(stroke.x, stroke.y, stroke.w, stroke.h);
    }
  }

  // ── Full redraw ─────────────────────────────────────────────────────────────

  function redraw(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTransform();

    for (const stroke of strokes) {
      renderStroke(stroke);
    }

    // Draw live rect preview on top
    if (currentRect) renderStroke(currentRect);
    if (otherUserCurrentRect) renderStroke(otherUserCurrentRect);
  }

  // ── Incremental draw helper (path only) ─────────────────────────────────────

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

  function getEraserWorldRadius(): number {
    return eraserSizeRef.current / viewTransformRef.current.scale;
  }

  function isInsideEraser(p: Point, center: Point, radius: number): boolean {
    return Math.hypot(p.x - center.x, p.y - center.y) <= radius;
  }

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

  function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }

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

  function strokeIntersectsEraser(
    stroke: Stroke,
    center: Point,
    radius: number,
  ): boolean {
    if (stroke.kind === "rect") {
      // Treat rect as 4 segments for eraser hit detection
      const { x, y, w, h } = stroke;
      const corners: [Point, Point][] = [
        [{ x, y }, { x: x + w, y }],
        [{ x: x + w, y }, { x: x + w, y: y + h }],
        [{ x: x + w, y: y + h }, { x, y: y + h }],
        [{ x, y: y + h }, { x, y }],
      ];
      return corners.some(
        ([a, b]) => pointToSegmentDistance(center, a!, b!) <= radius,
      );
    }
    const pts = stroke.points;
    if (pts.length === 0) return false;
    if (pts.length === 1) return isInsideEraser(pts[0]!, center, radius);
    for (let i = 0; i < pts.length - 1; i++) {
      if (pointToSegmentDistance(center, pts[i]!, pts[i + 1]!) <= radius)
        return true;
    }
    return false;
  }

  function splitStrokeByEraser(
    stroke: PathStroke,
    center: Point,
    radius: number,
  ): PathStroke[] {
    const pts = stroke.points;
    if (pts.length === 0) return [];

    const result: PathStroke[] = [];
    let currentPoints: Point[] = [];

    function finishSubStroke(): void {
      if (currentPoints.length >= 2) {
        result.push({
          id: nextStrokeId++,
          kind: "path",
          points: currentPoints,
          color: stroke.color,
          lineWidth: stroke.lineWidth,
        });
      }
      currentPoints = [];
    }

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
          currentPoints.push(lerp(a, b, ts[0]!));
          finishSubStroke();
          currentPoints.push(lerp(a, b, ts[1]!));
        }
        currentPoints.push(b);
      } else if (!aIn && bIn) {
        if (ts.length > 0) currentPoints.push(lerp(a, b, ts[0]!));
        finishSubStroke();
      } else if (aIn && !bIn) {
        if (ts.length > 0) currentPoints.push(lerp(a, b, ts[ts.length - 1]!));
        currentPoints.push(b);
      }
    }

    finishSubStroke();
    return result;
  }

  function eraseAt(center: Point): void {
    const radius = getEraserWorldRadius();
    let changed = false;

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i]!;
      if (!strokeIntersectsEraser(stroke, center, radius)) continue;

      if (stroke.kind === "rect") {
        // Rects are erased whole (no splitting)
        strokes.splice(i, 1);
        changed = true;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "erase_partial",
              roomId,
              x: center.x,
              y: center.y,
              erasedId: stroke.id,
              replacements: [],
            }),
          );
        }
      } else {
        const survivors = splitStrokeByEraser(stroke, center, radius);
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
                kind: "path" as const,
              })),
            }),
          );
        }
      }
    }

    if (changed) redraw();
  }

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  let isDrawing = false;
  let isDrawingRect = false;
  let isErasing = false;
  let lastPoint: Point | null = null;
  let rectOrigin: Point | null = null;

  function handleMouseDown(e: MouseEvent): void {
    const tool = selectedToolRef.current;
    const point = getMousePos(e);

    if (tool === "pencil") {
      isDrawing = true;
      lastPoint = point;
      const color = colorRef.current;
      const lineWidth = lineWidthRef.current;
      const strokeId = nextStrokeId++;
      currentStroke = { id: strokeId, kind: "path", points: [point], color, lineWidth };
      strokes.push(currentStroke);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "draw_start", roomId, x: point.x, y: point.y, color, lineWidth, strokeId }));
      }
    } else if (tool === "rect") {
      isDrawingRect = true;
      rectOrigin = point;
      const color = colorRef.current;
      const lineWidth = lineWidthRef.current;
      const strokeId = nextStrokeId++;
      currentRect = { id: strokeId, kind: "rect", x: point.x, y: point.y, w: 0, h: 0, color, lineWidth };
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "rect_start", roomId, x: point.x, y: point.y, color, lineWidth, strokeId }));
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
      drawSegment(lastPoint, point, currentStroke.color, currentStroke.lineWidth);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "draw_move", roomId, x: point.x, y: point.y }));
      }
      lastPoint = point;
    } else if (isDrawingRect && currentRect && rectOrigin) {
      const point = getMousePos(e);
      currentRect.x = Math.min(rectOrigin.x, point.x);
      currentRect.y = Math.min(rectOrigin.y, point.y);
      currentRect.w = Math.abs(point.x - rectOrigin.x);
      currentRect.h = Math.abs(point.y - rectOrigin.y);
      redraw(); // redraw preview each move
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "rect_move", roomId, x: point.x, y: point.y }));
      }
    } else if (isErasing) {
      eraseAt(getMousePos(e));
    }
  }

  function handleMouseUp(e: MouseEvent): void {
    if (isDrawing) {
      isDrawing = false;
      currentStroke = null;
      lastPoint = null;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const point = getMousePos(e);
        socket.send(JSON.stringify({ type: "draw_end", roomId, x: point.x, y: point.y }));
      }
    }

    if (isDrawingRect && currentRect) {
      isDrawingRect = false;
      // Only commit rects with meaningful size
      if (currentRect.w > 2 || currentRect.h > 2) {
        strokes.push(currentRect);
        if (socket && socket.readyState === WebSocket.OPEN) {
          const { x, y, w, h, color, lineWidth, id } = currentRect;
          socket.send(JSON.stringify({ type: "rect_end", roomId, x, y, x2: x + w, y2: y + h, color, lineWidth, strokeId: id }));
        }
      }
      currentRect = null;
      rectOrigin = null;
      redraw();
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
          kind: "path",
          points: [pt],
          color: data.color ?? "#ff0000",
          lineWidth: data.lineWidth ?? 2,
        };
        strokes.push(otherUserCurrentStroke);
      } else if (data.type === "draw_move" && data.roomId === roomId && otherUserCurrentStroke) {
        const prev = otherUserCurrentStroke.points[otherUserCurrentStroke.points.length - 1]!;
        const cur = { x: data.x, y: data.y };
        otherUserCurrentStroke.points.push(cur);
        drawSegment(prev, cur, otherUserCurrentStroke.color, otherUserCurrentStroke.lineWidth);
      } else if (data.type === "draw_end" && data.roomId === roomId) {
        otherUserCurrentStroke = null;

      } else if (data.type === "rect_start" && data.roomId === roomId) {
        otherUserCurrentRect = {
          id: data.strokeId ?? nextStrokeId++,
          kind: "rect",
          x: data.x, y: data.y, w: 0, h: 0,
          color: data.color ?? "#ff0000",
          lineWidth: data.lineWidth ?? 2,
        };
      } else if (data.type === "rect_move" && data.roomId === roomId && otherUserCurrentRect) {
        const ox = otherUserCurrentRect.x;
        const oy = otherUserCurrentRect.y;
        otherUserCurrentRect.x = Math.min(ox, data.x);
        otherUserCurrentRect.y = Math.min(oy, data.y);
        otherUserCurrentRect.w = Math.abs(data.x - ox);
        otherUserCurrentRect.h = Math.abs(data.y - oy);
        redraw();
      } else if (data.type === "rect_end" && data.roomId === roomId && data.x2 !== undefined && data.y2 !== undefined) {
        const rect: RectStroke = {
          id: data.strokeId ?? nextStrokeId++,
          kind: "rect",
          x: Math.min(data.x, data.x2),
          y: Math.min(data.y, data.y2),
          w: Math.abs(data.x2 - data.x),
          h: Math.abs(data.y2 - data.y),
          color: data.color ?? "#ff0000",
          lineWidth: data.lineWidth ?? 2,
        };
        if (rect.w > 2 || rect.h > 2) strokes.push(rect);
        otherUserCurrentRect = null;
        redraw();

      } else if (
        data.type === "erase_partial" &&
        data.roomId === roomId &&
        data.erasedId !== undefined &&
        data.replacements
      ) {
        const idx = strokes.findIndex((s) => s.id === data.erasedId);
        if (idx !== -1) {
          const survivors: PathStroke[] = data.replacements.map((r) => ({
            id: r.id,
            kind: "path" as const,
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
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: touch.clientX, clientY: touch.clientY }));
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: touch.clientX, clientY: touch.clientY }));
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
  if (socket) socket.addEventListener("message", handleWebSocketMessage);

  function cleanup(): void {
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mouseout", handleMouseUp);
    canvas.removeEventListener("touchstart", handleTouchStart);
    canvas.removeEventListener("touchmove", handleTouchMove);
    canvas.removeEventListener("touchend", handleTouchEnd);
    if (socket) socket.removeEventListener("message", handleWebSocketMessage);
  }

  return { cleanup, redraw };
}