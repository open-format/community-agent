import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { embedMany, embed } from "ai";
import { z } from "zod";
import { vectorStore } from '@/agent/stores';

// Define interface for the summary metadata
interface SummaryMetadata {
  platform: string;
  platformId: string;
  timestamp: Date | string;
  text: string;
  isReaction: boolean;
  isSummary: boolean;
  startDate: string;
  endDate: string;
  messageCount: number;
  uniqueUserCount: number;
  summarizationScore?: number | null;
  coverageScore?: number | null;
  alignmentScore?: number | null;
  summarizationReason?: string | null;
}

export const saveSummaryTool = createTool({
  id: "save-summary",
  description: "Save a community summary to the database with vector embeddings",
  inputSchema: z.object({
    communityId: z.string(),
    summary: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    summarizationResult: z.any().optional(),
    platformId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Extract the scores from the summarization result
      const summarizationScore = context.summarizationResult?.summarizationScore || null;
      const coverageScore = context.summarizationResult?.coverageScore || null;
      const alignmentScore = context.summarizationResult?.alignmentScore || null;
      const summarizationReason = context.summarizationResult?.reason || null;

      // Generate an ID for the summary
      const summaryId = crypto.randomUUID();

      // Generate embedding for the summary
      const embedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: context.summary,
      });

      // Create metadata for the summary in the same format as Discord messages
      const summaryMetadata: SummaryMetadata = {
        platform: "summary", // Indicates this is a summary
        platformId: context.platformId,
        timestamp: new Date(),
        text: context.summary,
        isReaction: false,
        isSummary: true, // Flag to identify as a summary
        startDate: context.startDate,
        endDate: context.endDate,
        messageCount: context.messageCount,
        uniqueUserCount: context.uniqueUserCount,
        summarizationScore,
        coverageScore,
        alignmentScore,
        summarizationReason
      };

      // Store in vector store
      await vectorStore.upsert({
        indexName: "community_messages",
        vectors: [embedding.embedding],
        metadata: [summaryMetadata],
      });

      return {
        success: true,
        summaryId,
      };
    } catch (error: any) {
      console.error("Exception saving summary:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
}); 