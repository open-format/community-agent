import { z } from "@hono/zod-openapi";

export const updatePlatformConnectionsRequest = z.object({
  communityId: z.string().nullable().optional(),
  platformName: z.string().nullable().optional(),
});

export const updatePlatformConnectionsResponse = z.object({
  id: z.string(),
  communityId: z.string().nullable(),
  platformId: z.string(),
  platformType: z.enum(["discord", "github", "telegram"]),
  platformName: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});
