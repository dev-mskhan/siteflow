import { z } from 'zod';

// ─── Common Pagination ────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ─── API Response envelope ────────────────────────────────────────────────────
export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── ID helpers ───────────────────────────────────────────────────────────────
export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;
