import express, { Router } from "express";
import { db } from "@repo/db/client";
import { AuthenticatedRequest, middleware } from "../middleware";
import { CreateRoomSchema } from "@repo/common/types";

const roomRouter: Router = express.Router();

roomRouter.post("/", middleware, async (req: AuthenticatedRequest, res) => {
  const parsed = CreateRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log(parsed.error);
    res.status(400).json({ message: "Invalid Input" });
    return;
  }
  const userId = req.userId!;
  try {
    const room = await db.room.create({
      data: { slug: parsed.data.name, adminId: userId },
    });
    res.json({ roomId: room.id });
  } catch (error) {
    res.status(500).json({ message: "Room already exists" });
  }
});

roomRouter.get("/user/rooms", middleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  try {
    const rooms = await db.room.findMany({
      where: { adminId: userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
});

roomRouter.get("/stats", middleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  try {
    const [totalRooms, totalNotes] = await Promise.all([
      db.room.count({ where: { adminId: userId } }),
      db.chat.count({ where: { userId } }),
    ]);
    res.json({ totalRooms, totalNotes });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

roomRouter.delete("/:id", middleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const roomId = Number(req.params.id);
  if (!Number.isInteger(roomId)) {
    res.status(400).json({ message: "Invalid room id" });
    return;
  }
  try {
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    if (room.adminId !== userId) {
      res.status(403).json({ message: "Only the room admin can delete this room" });
      return;
    }
    await db.$transaction([
      db.chat.deleteMany({ where: { roomId } }),
      db.room.delete({ where: { id: roomId } }),
    ]);
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete room" });
  }
});

roomRouter.get("/:slug", async (req, res) => {
  const room = await db.room.findUnique({
    where: { slug: req.params.slug },
  });
  if (!room) {
    res.status(404).json({ message: "Room not found" });
    return;
  }
  res.json(room);
});

export default roomRouter;
