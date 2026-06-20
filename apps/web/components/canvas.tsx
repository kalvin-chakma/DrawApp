"use client";

import { initDraw } from "../app/draw";
import { useEffect, useRef } from "react";

export interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

export function Canvas({
  roomId,
  socket,
  selectedTool,
  strokeColor,
  strokeWidth,
  eraserSize,
  viewTransform,
}: {
  roomId: string;
  socket?: WebSocket | null;
  selectedTool: string;
  strokeColor: string;
  strokeWidth: number;
  eraserSize: number;
  viewTransform: ViewTransform;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable refs so the draw loop always reads the latest values without
  // needing to re-initialise the event listeners.
  const viewTransformRef = useRef<ViewTransform>(viewTransform);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const selectedToolRef = useRef(selectedTool);
  const eraserSizeRef = useRef(eraserSize);

  // Keep tool / style refs in sync with props.
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

  // redrawRef lets the viewTransform effect call the latest redraw function
  // without depending on the draw-init effect.
  const redrawRef = useRef<() => void>(() => {});

  // Initialise the canvas buffer and wire up all drawing logic once.
  // Re-runs only when the room or socket identity changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const { cleanup, redraw } = initDraw(
      canvas,
      roomId,
      socket,
      selectedToolRef,
      strokeColorRef,
      strokeWidthRef,
      viewTransformRef,
      eraserSizeRef,
    );

    redrawRef.current = redraw;
    return cleanup;
  }, [roomId, socket]);

  // Whenever the view transform changes, sync the ref and trigger a full
  // redraw so all stored strokes repaint at the new pan / zoom position.
  useEffect(() => {
    viewTransformRef.current = viewTransform;
    redrawRef.current();
  }, [viewTransform]);

  const cursor =
    selectedTool === "pencil"
      ? "crosshair"
      : selectedTool === "eraser"
        ? "none"
        : selectedTool === "select"
          ? "default"
          : "crosshair";

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
        // No CSS transform — pan/zoom is handled by ctx.setTransform() inside
        // initDraw so the canvas buffer always covers the full viewport.
      }}
    />
  );
}
