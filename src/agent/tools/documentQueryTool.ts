import { openai } from "@ai-sdk/openai";
import { createVectorQueryTool } from "@mastra/rag";

export const documentQueryTool = createVectorQueryTool({
  vectorStoreName: "pgVector",
  indexName: "community_documents",
  model: openai.embedding("text-embedding-3-small"),
});
