import { z } from "@hono/zod-openapi";
import { addressSchema } from "../../utils/schema";

export const community = z.object({
  name: z.string(),
  description: z.string(),
  walletId: z.string(),
  walletAddress: addressSchema,
});

// Create a partial schema for updates
export const communityUpdate = community.partial();
