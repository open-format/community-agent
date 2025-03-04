import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { performCommunityScopedSimilaritySearch } from "../lib/document_processing";
import type { Community } from "../types";
import { checkpointer } from "./memory";
import { getModelWithTools } from "./models";
import { systemMessage } from "./prompts/systemMessage";
import { joinCommunityTool, learnTool } from "./tools";

const tools = [joinCommunityTool, learnTool];
const toolsNode = new ToolNode(tools);

// Model setup
const model = getModelWithTools("google", tools);

// Define the function that calls the model
async function callModel(
  state: typeof MessagesAnnotation.State,
  config: LangGraphRunnableConfig<{ metadata: { community: Community } }>
) {
  const community = config?.configurable?.metadata?.community;

  if (!community) {
    throw new Error("Community is required");
  }

  // Check if the last message contains skills and interests for context search
  const lastMessage = state.messages[state.messages.length - 1];
  let contextualInformation = null;

  contextualInformation = await performCommunityScopedSimilaritySearch(community.id, lastMessage.content.toString(), 3);

  // Modify the system message if contextual information is found
  const finalSystemMessage = systemMessage(community);
  if (contextualInformation) {
    finalSystemMessage.content += `\n\n**Contextual Insights:**\n${contextualInformation
      .map((doc) => doc.pageContent)
      .join("\n")}`;
  }

  const response = await model.invoke([finalSystemMessage, ...state.messages]);
  return {
    messages: [response],
    contextualInformation: contextualInformation,
  };
}

export const agent = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent")
  .addNode("tools", toolsNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", toolsCondition)
  .compile({ checkpointer: checkpointer });
