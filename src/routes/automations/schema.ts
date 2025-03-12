import { z } from "@hono/zod-openapi";
import { EVENT_TYPES, REWARD_TYPES } from "../../db/schema";

export const automation = z.object({
  communityId: z.string(),
  eventType: z.enum(EVENT_TYPES),
  rewardType: z.enum(REWARD_TYPES),
  rewardAmount: z.string(),
  rewardTokenAddress: z.string(),
});
