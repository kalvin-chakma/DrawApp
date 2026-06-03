// ws-server/index.ts
import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/common/env-variable";
import { db } from "@repo/db/client";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Close the other server (e.g. taskkill /PID <pid> /F) and try again.`
    );
  } else {
    console.error("WebSocket server error:", err);
  }
  process.exit(1);
});

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded == "string") {
      return null;
    }

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  } catch (e) {
    return null;
  }
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;
  if (!url) {
    return;
  }
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (userId == null) {
    ws.close();
    return null;
  }

  console.log(`User ${userId} connected`);

  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    let parsedData;
    if (typeof data !== "string") {
      parsedData = JSON.parse(data.toString());
    } else {
      parsedData = JSON.parse(data);
    }

    console.log("Message received:", parsedData);

    // Handle room joining
    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      if (user && !user.rooms.includes(parsedData.roomId)) {
        user.rooms.push(parsedData.roomId);
        console.log(`User ${userId} joined room ${parsedData.roomId}`);
      }
      return;
    }

    // Handle room leaving
    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user.rooms.filter((x) => x !== parsedData.roomId);
      console.log(`User ${userId} left room ${parsedData.roomId}`);
      return;
    }

    // Handle chat messages
    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;

      try {
        await db.chat.create({
          data: {
            roomId: Number(roomId),
            message,
            userId,
          },
        });

        // Broadcast to all users in the room
        users.forEach((user) => {
          if (user.rooms.includes(roomId)) {
            user.ws.send(
              JSON.stringify({
                type: "chat",
                message: message,
                roomId,
                userId,
              })
            );
          }
        });
      } catch (error) {
        console.error("Error saving chat message:", error);
      }
      return;
    }

    // Handle drawing events
    if (
      parsedData.type === "draw_start" ||
      parsedData.type === "draw_move" ||
      parsedData.type === "draw_end"
    ) {
      const roomId = parsedData.roomId;

      // Broadcast drawing event to all users in the same room except sender
      users.forEach((user) => {
        if (user.rooms.includes(roomId) && user.ws !== ws) {
          user.ws.send(
            JSON.stringify({
              type: parsedData.type,
              roomId: roomId,
              x: parsedData.x,
              y: parsedData.y,
              color: parsedData.color || "#ff0000", // Different color for other users
              lineWidth: parsedData.lineWidth || 2,
              userId: userId,
            })
          );
        }
      });
      return;
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log(`User ${userId} disconnected`);
    const index = users.findIndex((user) => user.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
  });
});
