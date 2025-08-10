import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().email(),
  password: z.string().min(6),
  name: z.string()
});

export const SigninSchema = z.object({
  username: z.string().email(),
  password: z.string()
});

export const CreateRoomSchema = z.object({
  name: z.string().min(3)
});
