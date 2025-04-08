import { openai } from "@ai-sdk/openai";
import { Agent, Mastra } from "@mastra/core";
import { ragAgentPrompt } from "./prompts/rag";
import { vectorStore } from "./stores/vectorStore";
import { vectorQueryTool } from "./tools/vectorQueryTool";
import { impactReportWorkflow } from "./workflows/impact";
import { rewardsWorkflow } from "./workflows/rewards";
import { summaryWorkflow } from "./workflows/summary";
import { alignmentAgent } from "./agents/alignment";
import { questionsWorkflow } from "./workflows/questions";
import { contextUpdateWorkflow } from "./workflows/contextUpdate";

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
    alignmentAgent,
  },
  workflows: {
    summaryWorkflow,
    impactReportWorkflow,
    rewardsWorkflow,
    questionsWorkflow,
    contextUpdateWorkflow,
  },
  vectors: { pgVector: vectorStore },
});
