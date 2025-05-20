export interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const createSuccessResponse = <T>(
  data: T,
  meta?: ApiResponse<T>["meta"],
): ApiResponse<T> => ({
  status: "success",
  data,
  meta,
});

export const createErrorResponse = (message: string, code?: string): ApiResponse<never> => ({
  status: "error",
  error: { message, code },
});
