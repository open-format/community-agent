import { rewardFacetAbi } from "@/abis/RewardFacet";
import { db } from "@/db";
import { automations, communities } from "@/db/schema";
import { getCommunityWallet } from "@/lib/viem";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { createWalletClient, http, parseEther, stringToHex, type Address } from "viem";
import { arbitrumSepolia } from "viem/chains";
import {
  createAutomation,
  deleteAutomation,
  getAutomations,
  triggerAutomation,
  updateAutomation,
} from "./routes";

const automationsRoute = new OpenAPIHono();

automationsRoute.openapi(getAutomations, async (c) => {
  const result = await db.select().from(automations);
  return c.json(result);
});

automationsRoute.openapi(createAutomation, async (c) => {
  const body = await c.req.json();

  // Check if community exists
  const community = await db
    .select()
    .from(communities)
    .where(eq(communities.id, body.communityId))
    .limit(1);

  if (!community.length) {
    return c.json({ message: "Community not found" }, 404);
  }

  await db.insert(automations).values(body);
  const [result] = await db
    .select()
    .from(automations)
    .where(eq(automations.communityId, body.communityId))
    .limit(1);
  return c.json(result);
});

automationsRoute.openapi(triggerAutomation, async (c) => {
  try {
    const { communityId, userId, eventType } = await c.req.json();

    const community = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
      columns: {
        id: true,
        communityWalletAddress: true,
      },
    });

    if (!community) {
      return c.json({ message: "Community not found" }, 404);
    }

    const automation = await db.query.automations.findFirst({
      where: and(eq(automations.communityId, communityId), eq(automations.eventType, eventType)),
    });

    if (!automation) {
      return c.json({ message: "Automation not found" }, 404);
    }

    const account = await getCommunityWallet(communityId);

    const client = createWalletClient({
      account,
      //@TODO - Dynamic fetch chain from request
      chain: arbitrumSepolia,
      transport: http(),
    });

    const hash = await client.writeContract({
      address: community.id as Address,
      abi: rewardFacetAbi,
      functionName: "mintERC20",
      args: [
        automation.rewardTokenAddress as Address,
        userId,
        parseEther(automation.rewardAmount as string),
        stringToHex(automation.eventType, { size: 32 }),
        stringToHex("MISSION", { size: 32 }),
        "ipfs://",
      ],
    });

    return c.json({
      hash,
      success: true,
    });
  } catch (error) {
    console.error("Error processing automation trigger:", error);
    return c.json(
      {
        message: "Error processing automation",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

automationsRoute.openapi(updateAutomation, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await db.update(automations).set(body).where(eq(automations.id, id));
  const [result] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
  return c.json(result);
});

automationsRoute.openapi(deleteAutomation, async (c) => {
  const id = c.req.param("id");
  await db.delete(automations).where(eq(automations.id, id));
  return c.json({ success: true });
});

export default automationsRoute;
