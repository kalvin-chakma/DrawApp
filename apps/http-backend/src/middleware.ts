import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/common/env-variable";

export interface AuthenticatedRequest extends Request {
   userId?: string;
}
export const middleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(authHeader, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
};