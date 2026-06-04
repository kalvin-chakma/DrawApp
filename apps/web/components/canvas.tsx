// components/canvas.tsx
import { initDraw } from "../app/draw";
import { useEffect, useRef } from "react";

export function Canvas({
  roomId,
  socket,
}: {
  socket?: WebSocket | null;
  roomId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const cleanup = initDraw(canvasRef.current, roomId, socket);

      return cleanup; // Return cleanup function
    }
  }, [canvasRef, roomId, socket]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Use your mouse to draw on the canvas. Changes are synced in real-time.
        </p>
      </div>
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="bg-white cursor-crosshair"
        />
      </div>
      <div className="mt-4 text-xs text-gray-500">
        {socket ? `Connected to room: ${roomId}` : `Free drawing (local)`}
      </div>
    </div>
  );
}
