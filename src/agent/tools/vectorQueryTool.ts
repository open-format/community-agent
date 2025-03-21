import { openai } from "@ai-sdk/openai";
import { createVectorQueryTool } from "@mastra/rag";

export const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "pgVector",
  indexName: "community_messages",
  model: openai.embedding("text-embedding-3-small"),
  enableFilter: true,
});
