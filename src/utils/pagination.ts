import { db } from "@/db";
// src/utils/pagination.ts
import { sql } from "drizzle-orm";
import type { PgSelect, PgTable } from "drizzle-orm/pg-core";

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function withPagination<T = any>(
  query: PgSelect,
  table: PgTable,
  params: PaginationParams = {},
): Promise<PaginatedResponse<T>> {
  const { page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(table);

  // Get paginated results
  const data = await query.limit(limit).offset(offset);

  return {
    data: data as T[],
    page,
    limit,
    total: Number(count),
    totalPages: Math.ceil(Number(count) / limit),
  };
}
