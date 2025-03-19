import { EVENT_TYPES, REWARD_TYPES } from "@/db/schema";
import { z } from "@hono/zod-openapi";

export const automation = z.object({
  communityId: z.string(),
  eventType: z.enum(EVENT_TYPES),
  rewardType: z.enum(REWARD_TYPES),
  rewardAmount: z.string(),
  rewardTokenAddress: z.string(),
});
