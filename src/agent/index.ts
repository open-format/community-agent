import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { pool } from "../db";
import type { Community } from "../types";
import { systemMessage } from "./prompts/systemMessage";
import { joinCommunityTool } from "./tools";

const tools = [joinCommunityTool];
const toolsNode = new ToolNode(tools);
export const checkpointer = new PostgresSaver(pool);

// Model setup
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
}).bindTools(tools);

// Define the function that calls the model
async function callModel(
  state: typeof MessagesAnnotation.State,
  config: LangGraphRunnableConfig<{ metadata: { community: Community } }>
) {
  const community = config?.configurable?.metadata?.community;

  if (!community) {
    throw new Error("Community is required");
  }

  const response = await model.invoke([systemMessage(community), ...state.messages]);
  return { messages: [response] };
}

export const agent = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent")
  .addNode("tools", toolsNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", toolsCondition)
  .compile({ checkpointer: checkpointer });
