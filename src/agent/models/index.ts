import type { DynamicStructuredTool } from "@langchain/core/tools";
import { model as googleModel } from "./google";
import { model as openaiModel } from "./openai";

type ModelProvider = "openai" | "google";

export function getModel(provider: ModelProvider) {
  if (provider === "openai") {
    return openaiModel;
  }
  return googleModel;
}

export function getModelWithTools(provider: ModelProvider, tools: DynamicStructuredTool<any>[]) {
  return getModel(provider).bindTools(tools);
}
