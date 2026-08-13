import express, { Router } from "express";
import { db } from "@repo/db/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  CreateUserSchema,
  SigninSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
} from "@repo/common/types";
import { JWT_SECRET } from "@repo/common/env-variable";
import { AuthenticatedRequest, middleware } from "../middleware";

const authRouter: Router = express.Router();

authRouter.post("/signup", async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log(parsed.error);
    res.status(400).json({ message: "Invalid request" });
    return;
  }
  const { username, password, name } = parsed.data;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        email: username,
        password: hashedPassword,
        name,
      },
    });
    res.json({ userId: user.id });
  } catch (error) {
    res.status(500).json({ message: "User already exists" });
  }
});

authRouter.post("/signin", async (req, res) => {
  const parsed = SigninSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log(parsed.error);
    res.status(400).json({ message: "Invalid Input" });
    return;
  }
  const { username, password } = parsed.data;
  const user = await db.user.findUnique({
    where: {
      email: username,
    },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(403).json({ message: "Not authorized" });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

authRouter.get("/me", middleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, photo: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

authRouter.put("/me", middleware, async (req: AuthenticatedRequest, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Input" });
    return;
  }
  const userId = req.userId!;
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        photo: parsed.data.photo || null,
      },
      select: { id: true, name: true, email: true, photo: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

authRouter.put(
  "/password",
  middleware,
  async (req: AuthenticatedRequest, res) => {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid Input" });
      return;
    }
    const userId = req.userId!;
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      const valid = await bcrypt.compare(
        parsed.data.currentPassword,
        user.password,
      );
      if (!valid) {
        res.status(403).json({ message: "Current password is incorrect" });
        return;
      }
      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
      await db.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      res.json({ message: "Password updated" });
    } catch {
      res.status(500).json({ message: "Failed to update password" });
    }
  },
);

authRouter.delete("/me", middleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  try {
    const rooms = await db.room.findMany({
      where: { adminId: userId },
      select: { id: true },
    });
    const roomIds = rooms.map((r) => r.id);
    await db.$transaction([
      db.chat.deleteMany({ where: { roomId: { in: roomIds } } }),
      db.chat.deleteMany({ where: { userId } }),
      db.room.deleteMany({ where: { adminId: userId } }),
      db.user.delete({ where: { id: userId } }),
    ]);
    res.json({ message: "Account deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete account" });
  }
});

export default authRouter;
