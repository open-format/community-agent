import { z } from "@hono/zod-openapi";
import { isAddress } from "viem";

const addressSchema = z.string().refine((value) => isAddress(value), "Invalid Ethereum address");

export const community = z.object({
  name: z.string(),
  description: z.string(),
  walletId: z.string(),
  walletAddress: addressSchema,
});

// Create a partial schema for updates
export const communityUpdate = community.partial();
