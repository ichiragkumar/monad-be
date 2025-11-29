/**
 * Common type definitions
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TransactionMetadata {
  eventId?: string;
  subscriptionId?: string;
  planName?: string;
  recipientIndex?: number;
  [key: string]: any;
}

