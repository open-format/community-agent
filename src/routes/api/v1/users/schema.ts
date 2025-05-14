import {z} from "@hono/zod-openapi";

export const user = z.object({
  id: z.string().uuid(),
  nickname: z.string().optional(),
  communityId: z.string().uuid(),
  did: z.string(),
  role: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  joinedAt: z.string().datetime(),
});

export const userUpdate = user.partial();