import { Request, Response, NextFunction } from "express";
import { config } from "@/config/env";
import { sendError, ErrorCode } from "@/utils/response.util";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = ErrorCode.INTERNAL_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isDevelopment = config.server.nodeEnv === "development";

  if (err instanceof AppError) {
    return sendError(
      res,
      err.code,
      err.message,
      err.statusCode,
      isDevelopment ? { stack: err.stack } : undefined
    );
  }

  // Handle known error types
  if (err.message.includes("ECONNREFUSED")) {
    return sendError(
      res,
      ErrorCode.INTERNAL_ERROR,
      "Blockchain connection failed: Unable to connect to Monad network",
      503
    );
  }

  // Validation errors (Zod)
  if ((err as any).issues) {
    return sendError(
      res,
      ErrorCode.INVALID_PARAMETERS,
      "Validation failed",
      400,
      (err as any).issues
    );
  }

  // Default error
  return sendError(
    res,
    ErrorCode.INTERNAL_ERROR,
    isDevelopment ? err.message : "Internal server error",
    500,
    isDevelopment ? { stack: err.stack } : undefined
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`,
  });
};

