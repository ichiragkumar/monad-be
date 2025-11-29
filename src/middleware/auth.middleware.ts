import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "@/config/env";

export interface AuthRequest extends Request {
  user?: {
    address: string;
    userId: string;
    role: string;
  };
}

/**
 * Extract JWT token from Authorization header
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as {
      address: string;
      userId: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token" });
    return;
  }
};

/**
 * Verify API key for internal operations
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== config.auth.apiKeySecret) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  next();
};

/**
 * Optional auth - sets user if token is present but doesn't fail if missing
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as {
        address: string;
        userId: string;
        role: string;
      };
      req.user = decoded;
    } catch (error) {
      // Ignore invalid tokens in optional auth
    }
  }

  next();
};

/**
 * Require vendor role
 */
export const requireVendor = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "VENDOR") {
    res.status(403).json({ error: "Vendor access required" });
    return;
  }

  next();
};

