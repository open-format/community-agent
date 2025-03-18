import { mastra } from "@/agent";
import { ragAgentPromptWithContext } from "@/agent/prompts/rag";
import { chainIdToSubgraphUrl, getCommunity } from "@/lib/subgraph";
import { Hono } from "hono";
import type { Address } from "viem";

const agentRoute = new Hono();

agentRoute.post("/message", async (c) => {
  const communityId = c.req.header("X-Community-ID") as Address;
  const userId = c.req.header("X-User-ID") as Address;
  const chain = c.req.header("X-Chain-ID") as keyof typeof chainIdToSubgraphUrl;

  const requestBody = (await c.req.json()) as { text?: string };

  if (!communityId) {
    return c.json({ message: "X-Community-ID header is required" }, 400);
  }
  if (!chain || !(chain in chainIdToSubgraphUrl)) {
    return c.json({ message: "X-Chain-ID header is required" }, 400);
  }

  const userMessage = requestBody.text;
  if (!userMessage) {
    return c.json({ message: "Message text is required in the request body" }, 400);
  }

  const community = await getCommunity(communityId, chain);

  if (!community) {
    return c.json({ message: "Community not found" }, 404);
  }

  try {
    const completion = await mastra
      .getAgent("ragAgent")
      .generate(ragAgentPromptWithContext(userMessage), {
        threadId: `${communityId}-${userId}`,
        resourceId: userId,
      });
    return c.json({
      result: completion.text,
      tool_results: completion.toolResults,
      tool_calls: completion.toolCalls,
    });
  } catch (error) {
    console.error("Error processing message with agent:", error);
    return c.json(
      {
        message: "Error processing your message",
        error: String(error),
      },
      500,
    );
  }
});

export default agentRoute;
