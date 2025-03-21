import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core";
import { embed } from "ai";
import dayjs from "dayjs";
import { z } from "zod";

export const fetchCommunityMessagesTool = createTool({
  id: "fetch-community-messages",
  description: "Fetch messages from vector store for a specific platform ID and date range",
  inputSchema: z.object({
    startDate: z.number(),
    endDate: z.number(),
    platformId: z.string().nonempty(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
  }),
  execute: async ({ context }: FetchCommunityMessagesToolContext) => {
    try {
      // Create a dummy embedding for the query
      const dummyEmbedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: "community messages",
      });

      // Query the vector store for messages between a specific time with a specific platformId
      const queryResults = (await vectorStore.query({
        indexName: "community_messages",
        queryVector: dummyEmbedding.embedding,
        topK: 10000,
        includeMetadata: true,
        filter: {
          platformId: context.platformId,
          $and: [
            { timestamp: { $gte: context.startDate } },
            { timestamp: { $lte: context.endDate } },
          ],
          isBotQuery: {
            $eq: false,
          },
        },
      })) as VectorStoreResult[];

      // If we found no messages
      if (queryResults.length === 0) {
        return {
          transcript: `No messages found for platformId "${context.platformId}" in the date range ${context.startDate} to ${context.endDate}.`,
          messageCount: 0,
          uniqueUserCount: 0,
        };
      }

      // Track unique users
      const userSet = new Set<string>();

      // Convert queryResults to a standard format for processing
      const messages: VectorStoreResult[] = queryResults;

      for (const message of messages) {
        if (message?.metadata?.authorId) {
          userSet.add(message.metadata.authorId);
        }
      }

      // Sort messages by timestamp
      const sortedMessages = messages.sort((a: VectorStoreResult, b: VectorStoreResult) => {
        return b.metadata.timestamp - a.metadata.timestamp; // For descending order (newest first)
      });

      // Format messages into transcript
      const transcript = sortedMessages
        .map((message: VectorStoreResult) => {
          // Format date and content
          const datetime = message.metadata.timestamp;
          const username = message.metadata.authorUsername || "Unknown User";
          const content = message.metadata.text || "[No content]";

          // Simple, consistent format for all messages
          return `[${dayjs(datetime).format("MM/DD/YYYY HH:mm")}] ${username}: ${content}`;
        })
        .join("\n");

      return {
        transcript: transcript || "No valid messages found after filtering.",
        messageCount: messages.length,
        uniqueUserCount: userSet.size,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(`No messages found in this community. Details: ${err.message}`);
      }
      throw new Error("No messages found in this community. Unknown error occurred.");
    }
  },
});
