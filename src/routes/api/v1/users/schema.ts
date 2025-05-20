import { z } from "@hono/zod-openapi";

export const user = z.object({
  did: z.string(),
});

export const userUpdate = user.partial();

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  communityId: z.string().uuid(),
  roleName: z.string(),
});
