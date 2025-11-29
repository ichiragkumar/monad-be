import { Response } from "express";

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Send success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
  } as ApiResponse<T>);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  } as ApiResponse);
};

/**
 * Send paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  items: T[],
  page: number,
  limit: number,
  total: number
): Response => {
  const totalPages = Math.ceil(total / limit);
  return res.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  } as ApiResponse<T[]>);
};

/**
 * Error codes enum
 */
export enum ErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
  TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
}

