"use client";

import { useEffect, useState } from "react";
import { Canvas } from "./canvas";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

export function RoomCanvas({
  roomId,
  token,
}: {
  roomId: string;
  token: string;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "error" | "closed"
  >("connecting");

  useEffect(() => {
    if (!token || !roomId) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnectionStatus("connected");
      setSocket(ws);

      // Join the room
      const joinMessage = JSON.stringify({
        type: "join_room",
        roomId,
      });

      console.log("Joining room:", joinMessage);
      ws.send(joinMessage);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("error");
      setSocket(null);
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed:", event.code, event.reason);
      setConnectionStatus("closed");
      setSocket(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);

        // Handle different message types if needed
        if (data.type === "chat") {
          console.log("Chat message received:", data.message);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Leave room before closing
        ws.send(
          JSON.stringify({
            type: "leave_room",
            roomId,
          })
        );
      }
      ws.close();
    };
  }, [roomId, token]);

  const getStatusDisplay = () => {
    switch (connectionStatus) {
      case "connecting":
        return (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-gray-600">Connecting to server...</span>
          </div>
        );
      case "error":
        return (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Connection Error</p>
            <p>
              Failed to connect to the drawing server. Please check your
              connection and try again.
            </p>
          </div>
        );
      case "closed":
        return (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p className="font-bold">Connection Closed</p>
            <p>
              Connection to the drawing server has been closed. Please refresh
              the page to reconnect.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (!socket || connectionStatus !== "connected") {
    return (
      <div className="min-h-96 flex items-center justify-center">
        {getStatusDisplay()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">
            Connected to room {roomId}
          </span>
        </div>
      </div>

      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}
