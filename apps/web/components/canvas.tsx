"use client";

import { initDraw } from "../app/draw";
import { useEffect, useRef } from "react";

export function Canvas({
  roomId,
  socket,
  selectedTool,
  strokeColor,
  strokeWidth,
}: {
  roomId: string;
  socket?: WebSocket | null;
  selectedTool: string;
  strokeColor: string;
  strokeWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (selectedTool !== "pencil") return;
    const cleanup = initDraw(canvas, roomId, socket, {
      color: strokeColor,
      lineWidth: strokeWidth,
    });
    return cleanup;
  }, [roomId, socket, selectedTool, strokeColor, strokeWidth]);

  const cursor =
    selectedTool === "pencil"
      ? "crosshair"
      : selectedTool === "eraser"
        ? "cell"
        : "default";

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      style={{ cursor }}
    />
  );
}
