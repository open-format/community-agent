import { openai } from "@ai-sdk/openai";
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { memory } from "./memory";
import { ragAgentPrompt } from "./prompts/rag";
import { vectorStore } from "./stores/vectorStore";
import { vectorQueryTool } from "./tools/vectorQueryTool";

export const ragAgent = new Agent({
  name: "RAG Agent One",
  instructions: ragAgentPrompt,
  model: openai("gpt-4o-mini"),
  tools: {
    vectorQueryTool,
  },
  memory: memory,
});

export const mastra = new Mastra({
  agents: {
    ragAgent,
  },
  vectors: { pgVector: vectorStore },
});
