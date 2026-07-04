"use client";

import { initDraw } from "../app/draw";
import { useEffect, useRef } from "react";
import type { LineVariant } from "../app/draw/types";

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
  lineVariant = "solid",
}: {
  roomId: string;
  socket?: WebSocket | null;
  selectedTool: string;
  strokeColor: string;
  strokeWidth: number;
  eraserSize: number;
  viewTransform: ViewTransform;
  lineVariant?: LineVariant;
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
      lineVariantRef,
    );

    redrawRef.current = redraw;
    return cleanup;
  }, [roomId, socket]);

  useEffect(() => {
    viewTransformRef.current = viewTransform;
    redrawRef.current();
  }, [viewTransform]);

  const cursor =
    selectedTool === "pencil" ||
    selectedTool === "line" ||
    selectedTool === "rect" ||
    selectedTool === "circle"
      ? "crosshair"
      : selectedTool === "eraser"
        ? "none"
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
