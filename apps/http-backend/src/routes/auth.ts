import express, { Router } from "express";
import { db } from "@repo/db/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { CreateUserSchema, SigninSchema } from "@repo/common/types";
import { JWT_SECRET } from "@repo/common/env-variable";

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

export default authRouter;
