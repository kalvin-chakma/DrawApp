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

export function initDraw(
  canvas: HTMLCanvasElement,
  roomId: string,
  socket?: WebSocket | null
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Failed to get 2D context from canvas");
    return () => {};
  }

  const canSend = () => {
    return Boolean(socket && socket.readyState === WebSocket.OPEN);
  };

  let isDrawing = false;
  let lastPoint: Point | null = null;

  // Drawing settings
  const color = "#000000";
  const lineWidth = 2;

  // Set up canvas context
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Get canvas position for accurate mouse coordinates
  function getMousePos(e: MouseEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // Draw line function
  function drawLine(
    ctx: CanvasRenderingContext2D, // Pass ctx as a parameter
    from: Point,
    to: Point,
    strokeColor = color,
    strokeWidth = lineWidth
  ) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Mouse down event
  function handleMouseDown(e: MouseEvent) {
    isDrawing = true;
    const point = getMousePos(e);
    lastPoint = point;

    // Send draw start event (when websocket is enabled)
    if (canSend()) {
      const drawEvent: DrawEvent = {
        type: "draw_start",
        roomId,
        x: point.x,
        y: point.y,
        color,
        lineWidth,
      };

      socket!.send(JSON.stringify(drawEvent));
    }
  }

  // Mouse move event
  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing || !lastPoint) return;

    const currentPoint = getMousePos(e);

    // Draw locally
    drawLine(ctx as CanvasRenderingContext2D, lastPoint, currentPoint); // Pass ctx

    // Send draw move event (when websocket is enabled)
    if (canSend()) {
      const drawEvent: DrawEvent = {
        type: "draw_move",
        roomId,
        x: currentPoint.x,
        y: currentPoint.y,
      };

      socket!.send(JSON.stringify(drawEvent));
    }

    lastPoint = currentPoint;
  }

  // Mouse up event
  function handleMouseUp(e: MouseEvent) {
    if (!isDrawing) return;

    isDrawing = false;
    const point = getMousePos(e);

    // Send draw end event (when websocket is enabled)
    if (canSend()) {
      const drawEvent: DrawEvent = {
        type: "draw_end",
        roomId,
        x: point.x,
        y: point.y,
      };

      socket!.send(JSON.stringify(drawEvent));
    }

    lastPoint = null;
  }

  // Handle incoming draw events from other users
  let otherUserLastPoint: Point | null = null;

  function handleWebSocketMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "draw_start" && data.roomId === roomId) {
        otherUserLastPoint = { x: data.x, y: data.y };
      } else if (
        data.type === "draw_move" &&
        data.roomId === roomId &&
        otherUserLastPoint
      ) {
        const currentPoint = { x: data.x, y: data.y };
        drawLine(
          ctx as CanvasRenderingContext2D,
          otherUserLastPoint,
          currentPoint,
          data.color || "#ff0000",
          data.lineWidth || 2
        );
        otherUserLastPoint = currentPoint;
      } else if (data.type === "draw_end" && data.roomId === roomId) {
        otherUserLastPoint = null;
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  // Add event listeners
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseout", handleMouseUp); // Stop drawing when mouse leaves canvas
  if (socket) {
    socket.addEventListener("message", handleWebSocketMessage);
  }

  // Touch events for mobile support
  function handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return; // Check if touch exists
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  }

  function handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return; // Check if touch exists
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  }

  function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup", {});
    canvas.dispatchEvent(mouseEvent);
  }

  canvas.addEventListener("touchstart", handleTouchStart);
  canvas.addEventListener("touchmove", handleTouchMove);
  canvas.addEventListener("touchend", handleTouchEnd);

  // Return cleanup function
  return () => {
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
  };
}
