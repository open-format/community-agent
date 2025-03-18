import { addressSchema } from "@/utils/schema";
import { z } from "@hono/zod-openapi";

export const community = z.object({
  name: z.string(),
  description: z.string(),
  walletId: z.string(),
  walletAddress: addressSchema,
});

// Create a partial schema for updates
export const communityUpdate = community.partial();
