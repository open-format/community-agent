import { vi } from "vitest";

export const mockVectorStore = {
  createIndex: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  deleteIndexById: vi.fn().mockResolvedValue(undefined),
};

export const mockPgPool = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

export const mockPgVector = {
  createIndex: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  deleteIndexById: vi.fn().mockResolvedValue(undefined),
};
