"use client";

import { initDraw } from "../app/draw";
import { useEffect, useRef } from "react";
import type { LineVariant, Stroke } from "../app/draw/types";

export interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

const CROSSHAIR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'>" +
  "<g stroke='black' stroke-width='1.6' stroke-linecap='round'>" +
  "<line x1='11' y1='2' x2='11' y2='8.5'/>" +
  "<line x1='11' y1='13.5' x2='11' y2='20'/>" +
  "<line x1='2' y1='11' x2='8.5' y2='11'/>" +
  "<line x1='13.5' y1='11' x2='20' y2='11'/>" +
  "</g>" +
  "<circle cx='11' cy='11' r='1.4' fill='black'/>" +
  "</svg>";
const CROSSHAIR_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CROSSHAIR_SVG)}") 11 11, crosshair`;

function buildEraserCursor(radius: number): string {
  const r = Math.max(4, Math.min(radius, 40));
  const size = r * 2 + 4;
  const c = size / 2;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
    `<circle cx='${c}' cy='${c}' r='${r}' fill='rgba(255,255,255,0.35)' stroke='black' stroke-width='1.5'/>` +
    `<circle cx='${c}' cy='${c}' r='1.2' fill='black'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, auto`;
}

export function Canvas({
  roomId,
  socket,
  selectedTool,
  strokeColor,
  strokeWidth,
  eraserSize,
  viewTransform,
  lineVariant = "solid",
  onPinchAction,
  initialStrokes,
  onStrokesChange,
}: {
  roomId: string;
  socket?: WebSocket | null;
  selectedTool: string;
  strokeColor: string;
  strokeWidth: number;
  eraserSize: number;
  viewTransform: ViewTransform;
  lineVariant?: LineVariant;
  onPinchAction?: (factor: number, cx: number, cy: number) => void;
  initialStrokes?: Stroke[];
  onStrokesChange?: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const viewTransformRef = useRef<ViewTransform>(viewTransform);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const selectedToolRef = useRef(selectedTool);
  const eraserSizeRef = useRef(eraserSize);
  const lineVariantRef = useRef<LineVariant>(lineVariant);

  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);
  useEffect(() => {
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);
  useEffect(() => {
    lineVariantRef.current = lineVariant;
  }, [lineVariant]);

  const redrawRef = useRef<() => void>(() => {});

  const onPinchActionRef = useRef(onPinchAction);
  useEffect(() => {
    onPinchActionRef.current = onPinchAction;
  }, [onPinchAction]);

  const onStrokesChangeRef = useRef(onStrokesChange);
  useEffect(() => {
    onStrokesChangeRef.current = onStrokesChange;
  }, [onStrokesChange]);

  const initialStrokesRef = useRef(initialStrokes);
  useEffect(() => {
    initialStrokesRef.current = initialStrokes;
  }, [initialStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      redrawRef.current();
    });
    resizeObserver.observe(canvas);

    const { cleanup, redraw } = initDraw(
      canvas,
      roomId,
      socket,
      selectedToolRef,
      strokeColorRef,
      strokeWidthRef,
      viewTransformRef,
      eraserSizeRef,
      lineVariantRef,
      (factor, cx, cy) => onPinchActionRef.current?.(factor, cx, cy),
      initialStrokesRef.current,
      (strokes) => onStrokesChangeRef.current?.(strokes),
    );

    redrawRef.current = redraw;
    return () => {
      cleanup();
      resizeObserver.disconnect();
    };
  }, [roomId, socket]);

  useEffect(() => {
    viewTransformRef.current = viewTransform;
    redrawRef.current();
  }, [viewTransform]);

  const cursor =
    selectedTool === "pencil" ||
    selectedTool === "line" ||
    selectedTool === "rect" ||
    selectedTool === "circle" ||
    selectedTool === "triangle"
      ? CROSSHAIR_CURSOR
      : selectedTool === "eraser"
        ? buildEraserCursor(eraserSize)
        : "default";

  return (
    <canvas
      ref={canvasRef}
      className="absolute touch-none"
      style={{
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        cursor,
        backgroundColor: "#ffffff",
      }}
    />
  );
}
