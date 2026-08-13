import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
});

export const SigninSchema = z.object({
  username: z.string().email(),
  password: z.string(),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(3),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1),
  photo: z.string().url().optional().or(z.literal("")),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
