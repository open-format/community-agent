import { OpenAPIHono } from "@hono/zod-openapi";
import { postAlignmentChat } from "./routes";
import { generateContextPrompt } from "@/agent/agents/alignment";

const alignmentRoute = new OpenAPIHono();

// Chat with the alignment agent
alignmentRoute.openapi(postAlignmentChat, async (c) => {
  try {
    console.log("[Alignment API] Received chat request");
    const { message } = await c.req.json();
    const community_id = c.req.header("X-Community-ID");
    
    console.log(`[Alignment API] Processing request for community: ${community_id}`);
    
    if (!community_id) {
      console.log("[Alignment API] Error: Missing community ID");
      return c.json({ message: "Community ID is required" }, 400);
    }
    
    if (!message) {
      console.log("[Alignment API] Error: Missing message");
      return c.json({ message: "Message is required" }, 400);
    }

    console.log(`[Alignment API] Calling alignment agent with message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Process the query with the alignment agent
    const response = await generateContextPrompt(community_id, message);

    console.log(`[Alignment API] Received response from alignment agent`);
    
    return c.json({
      response,
    });
  } catch (error) {
    console.error("[Alignment API] Error processing alignment chat:", error);
    return c.json({ 
      message: "Failed to process alignment chat", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default alignmentRoute; 