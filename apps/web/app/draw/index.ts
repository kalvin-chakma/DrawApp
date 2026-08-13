import type {
  Point,
  Stroke,
  ViewTransform,
  Ref,
  DrawEvent,
  StrokeType,
  LineVariant,
} from "./types";
import { createRenderer } from "./renderer";
import { strokeIntersectsEraser, splitStrokeByEraser } from "./eraser";

export function initDraw(
  canvas: HTMLCanvasElement,
  roomId: string,
  socket: WebSocket | null | undefined,
  selectedToolRef: Ref<string>,
  colorRef: Ref<string>,
  lineWidthRef: Ref<number>,
  viewTransformRef: Ref<ViewTransform>,
  eraserSizeRef: Ref<number>,
  lineVariantRef: Ref<LineVariant>,
  onPinch?: (factor: number, cx: number, cy: number) => void,
  initialStrokes?: Stroke[],
  onChange?: (strokes: Stroke[]) => void,
): { cleanup: () => void; redraw: () => void } {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    console.error("Failed to get 2D context from canvas");
    return { cleanup: () => {}, redraw: () => {} };
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const strokes: Stroke[] = initialStrokes ? [...initialStrokes] : [];
  let nextStrokeId = Math.floor(Math.random() * 1e9);
  const getNextId = () => nextStrokeId++;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const renderer = createRenderer(canvas, ctx, viewTransformRef, strokes);
  if (strokes.length > 0) renderer.redraw();

  const SHAPE_TYPES: StrokeType[] = ["rect", "circle", "line", "triangle"];

  function toolToStrokeType(tool: string): StrokeType | null {
    if (tool === "pencil") return "pencil";
    if (tool === "rect") return "rect";
    if (tool === "circle") return "circle";
    if (tool === "line") return "line";
    if (tool === "triangle") return "triangle";
    return null;
  }

  let currentStroke: Stroke | null = null;
  let otherUserCurrentStroke: Stroke | null = null;

  // Eraser

  function getEraserWorldRadius(): number {
    return eraserSizeRef.current / viewTransformRef.current.scale;
  }

  function eraseAt(center: Point): void {
    const radius = getEraserWorldRadius();
    let changed = false;

    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i]!;
      if (!strokeIntersectsEraser(stroke, center, radius)) continue;

      const survivors = splitStrokeByEraser(stroke, center, radius, getNextId);
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
              type: s.type,
              points: s.points,
              color: s.color,
              lineWidth: s.lineWidth,
            })),
          } satisfies DrawEvent),
        );
      }
    }

    if (changed) {
      renderer.redraw();
      onChange?.(strokes);
    }
  }

  function commitOrDiscardShape(stroke: Stroke): void {
    if (stroke.type === "pencil") return;
    const p1 = stroke.points[0]!;
    const p2 = stroke.points[1]!;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist <= 2) {
      const idx = strokes.findIndex((s) => s.id === stroke.id);
      if (idx !== -1) strokes.splice(idx, 1);
    }
  }

  // Mouse handlers

  let isDrawing = false;
  let isErasing = false;
  let lastPoint: Point | null = null;

  function handleMouseDown(e: MouseEvent): void {
    const tool = selectedToolRef.current;
    const point = renderer.getMousePos(e);
    const strokeType = toolToStrokeType(tool);

    if (strokeType === "pencil") {
      isDrawing = true;
      lastPoint = point;
      const color = colorRef.current;
      const lineWidth = lineWidthRef.current;
      const strokeId = getNextId();
      currentStroke = { id: strokeId, type: "pencil", points: [point], color, lineWidth };
      strokes.push(currentStroke);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "draw_start",
            roomId,
            x: point.x,
            y: point.y,
            color,
            lineWidth,
            strokeId,
            strokeType: "pencil",
          } satisfies DrawEvent),
        );
      }
    } else if (strokeType && SHAPE_TYPES.includes(strokeType)) {
      isDrawing = true;
      const color = colorRef.current;
      const lineWidth = lineWidthRef.current;
      const strokeId = getNextId();
      const lineVariant = strokeType === "line" ? lineVariantRef.current : undefined;

      currentStroke = {
        id: strokeId,
        type: strokeType,
        points: [point, point],
        color,
        lineWidth,
        ...(lineVariant ? { lineVariant } : {}),
      };
      strokes.push(currentStroke);
      renderer.redraw();

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "draw_start",
            roomId,
            x: point.x,
            y: point.y,
            color,
            lineWidth,
            strokeId,
            strokeType,
            ...(lineVariant ? { lineVariant } : {}),
          } satisfies DrawEvent),
        );
      }
    } else if (tool === "eraser") {
      isErasing = true;
      eraseAt(point);
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (isDrawing && currentStroke) {
      const point = renderer.getMousePos(e);

      if (currentStroke.type === "pencil") {
        if (!lastPoint) return;
        currentStroke.points.push(point);
        renderer.drawSegment(lastPoint, point, currentStroke.color, currentStroke.lineWidth);
        lastPoint = point;
      } else {
        // Shapes only ever carry two points: origin + live cursor position.
        currentStroke.points[1] = point;
        renderer.redraw();
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "draw_move", roomId, x: point.x, y: point.y } satisfies DrawEvent),
        );
      }
    } else if (isErasing) {
      eraseAt(renderer.getMousePos(e));
    }
  }

  function handleMouseUp(e: MouseEvent): void {
    if (isDrawing && currentStroke) {
      const point = renderer.getMousePos(e);
      if (currentStroke.type !== "pencil") {
        currentStroke.points[1] = point;
      }
      commitOrDiscardShape(currentStroke);

      isDrawing = false;
      currentStroke = null;
      lastPoint = null;
      renderer.redraw();
      onChange?.(strokes);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "draw_end", roomId, x: point.x, y: point.y } satisfies DrawEvent),
        );
      }
    }

    if (isErasing) isErasing = false;
  }

  // WebSocket handler

  function handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as DrawEvent & { roomId: string };
      if (data.roomId !== roomId) return;

      if (data.type === "draw_start") {
        const pt = { x: data.x, y: data.y };
        const strokeType: StrokeType = data.strokeType ?? "pencil";
        otherUserCurrentStroke = {
          id: data.strokeId ?? getNextId(),
          type: strokeType,
          points: strokeType === "pencil" ? [pt] : [pt, pt],
          color: data.color ?? "#ff0000",
          lineWidth: data.lineWidth ?? 2,
          ...(data.lineVariant ? { lineVariant: data.lineVariant } : {}),
        };
        strokes.push(otherUserCurrentStroke);
        renderer.redraw();
      } else if (data.type === "draw_move" && otherUserCurrentStroke) {
        const cur = { x: data.x, y: data.y };
        if (otherUserCurrentStroke.type === "pencil") {
          const prev = otherUserCurrentStroke.points[otherUserCurrentStroke.points.length - 1]!;
          otherUserCurrentStroke.points.push(cur);
          renderer.drawSegment(
            prev,
            cur,
            otherUserCurrentStroke.color,
            otherUserCurrentStroke.lineWidth,
          );
        } else {
          otherUserCurrentStroke.points[1] = cur;
          renderer.redraw();
        }
      } else if (data.type === "draw_end") {
        if (otherUserCurrentStroke) commitOrDiscardShape(otherUserCurrentStroke);
        otherUserCurrentStroke = null;
        renderer.redraw();
      } else if (
        data.type === "erase_partial" &&
        data.erasedId !== undefined &&
        data.replacements
      ) {
        const idx = strokes.findIndex((s) => s.id === data.erasedId);
        if (idx !== -1) {
          const survivors: Stroke[] = data.replacements.map((r) => ({
            id: r.id,
            type: r.type,
            points: r.points,
            color: r.color,
            lineWidth: r.lineWidth,
          }));
          strokes.splice(idx, 1, ...survivors);
          renderer.redraw();
        }
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  }

  // Touch handlers
  let lastTouchDist: number | null = null;

  function getTouchDist(e: TouchEvent): number {
    const a = e.touches[0]!;
    const b = e.touches[1]!;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function getTouchMidpoint(e: TouchEvent): { x: number; y: number } {
    const a = e.touches[0]!;
    const b = e.touches[1]!;
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 2) {
      if (isDrawing && currentStroke) {
        commitOrDiscardShape(currentStroke);
        isDrawing = false;
        currentStroke = null;
        lastPoint = null;
        renderer.redraw();
      }
      lastTouchDist = getTouchDist(e);
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const synth = new MouseEvent("mousedown", {
      bubbles: false,
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    handleMouseDown(synth);
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getTouchDist(e);
      if (lastTouchDist !== null) {
        const factor = dist / lastTouchDist;
        const mid = getTouchMidpoint(e);
        onPinch?.(factor, mid.x, mid.y);
      }
      lastTouchDist = dist;
      return;
    }
    lastTouchDist = null;
    const touch = e.touches[0];
    if (!touch) return;
    const synth = new MouseEvent("mousemove", {
      bubbles: false,
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    handleMouseMove(synth);
  }

  function handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    lastTouchDist = null;
    if (e.touches.length > 0) return;
    const changed = e.changedTouches[0];
    const synth = new MouseEvent("mouseup", {
      bubbles: false,
      clientX: changed?.clientX ?? 0,
      clientY: changed?.clientY ?? 0,
    });
    handleMouseUp(synth);
  }

  // Register listeners

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseout", handleMouseUp);
  canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
  if (socket) socket.addEventListener("message", handleWebSocketMessage);

  function cleanup(): void {
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mouseout", handleMouseUp);
    canvas.removeEventListener("touchstart", handleTouchStart);
    canvas.removeEventListener("touchmove", handleTouchMove);
    canvas.removeEventListener("touchend", handleTouchEnd);
    canvas.removeEventListener("touchcancel", handleTouchEnd);
    if (socket) socket.removeEventListener("message", handleWebSocketMessage);
  }

  return { cleanup, redraw: renderer.redraw };
}
