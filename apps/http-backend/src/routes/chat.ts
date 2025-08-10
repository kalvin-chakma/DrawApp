import express, { Router } from "express";
import { db } from "@repo/db/client";
import { AuthenticatedRequest, middleware } from "../middleware";

const chatRouter: Router = express.Router();

chatRouter.get("/:roomId", async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const messages = await db.chat.findMany({
      where: { roomId },
      orderBy: { id: "desc" },
      take: 1000,
    });
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ messages: [] });
  }
});

chatRouter.post("/", middleware, async (req: AuthenticatedRequest, res) => {
  const { roomId, message } = req.body;
  const userId = req.userId;

  if (!roomId || !message) {
    return res.status(400).json({ message: "Missing roomId or message" });
  }

  try {
    const chat = await db.chat.create({
      data: {
        roomId,
        message,
        userId: userId!,
      },
    });
    res.json({ chat });
  } catch (e) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default chatRouter;
