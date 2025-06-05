import { addressSchema } from "@/utils/schema";
import { z } from "@hono/zod-openapi";

export const community = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  communityWalletId: z.string().optional(),
  communityWalletAddress: addressSchema.optional(),
});

// Create a partial schema for updates
export const communityUpdate = community.partial();
