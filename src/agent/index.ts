import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { Agent, Mastra } from "@mastra/core";
import { memory } from "./memory";
import { ragAgentPrompt } from "./prompts/rag";
import { summaryAgentPrompt } from "./prompts/summaries";
import { vectorStore } from "./stores/vectorStore";
import { getMessagesTool } from "./tools";
import { vectorQueryTool } from "./tools/vectorQueryTool";
import { impactReportWorkflow } from "./workflows/impact";
import { rewardsWorkflow } from "./workflows/rewards";
import { summaryWorkflow } from "./workflows/summary";

export const ragAgent = new Agent({
  name: "RAG Agent One",
  instructions: ragAgentPrompt,
  model: openai("gpt-4o"),
  tools: {
    vectorQueryTool,
  },
});

export const summaryAgent = new Agent({
  name: "Summary Agent",
  instructions: summaryAgentPrompt,
  // @ts-ignore Fix types
  model: google("gemini-2.0-flash-001"),
  tools: {
    getMessagesTool,
  },
  // @ts-ignore Fix types
  memory: memory,
});

export const mastra = new Mastra({
  agents: {
    ragAgent,
    summaryAgent,
  },
  workflows: {
    summaryWorkflow,
    impactReportWorkflow,
    rewardsWorkflow,
  },
  // @ts-ignore Fix types
  vectors: { pgVector: vectorStore },
});
