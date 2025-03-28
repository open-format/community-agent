import { openai } from "@ai-sdk/openai";
import { Agent, Mastra } from "@mastra/core";
import { ragAgentPrompt } from "./prompts/rag";
import { vectorStore } from "./stores/vectorStore";
import { vectorQueryTool } from "./tools/vectorQueryTool";
import { summaryWorkflow } from "./workflows/summary";
import { impactReportWorkflow } from "./workflows/impact";
import { rewardsWorkflow } from "./workflows/rewards";

export const ragAgent = new Agent({
  name: "RAG Agent One",
  instructions: ragAgentPrompt,
  model: openai("gpt-4o"),
  tools: {
    vectorQueryTool,
  },
});

export const mastra = new Mastra({
  agents: {
    ragAgent,
  },
  workflows: {
    summaryWorkflow,
    impactReportWorkflow,
    rewardsWorkflow,
  },
  vectors: { pgVector: vectorStore },
});
