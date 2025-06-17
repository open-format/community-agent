import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core";
import { embed } from "ai";
import dayjs from "dayjs";
import { z } from "zod";

export const saveSummaryTool = createTool({
  id: "save-summary",
  description: "Save a community summary to the database with vector embeddings",
  inputSchema: z.object({
    summary: z.string(),
    startDate: z.number(),
    endDate: z.number(),
    summarizationResult: z.any().optional(),
    platformId: z.string().optional(),
    communityId: z.string(),
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

      const summaryMetadata: SummaryMetadata = {
        isCombined: context.platformId ? false : true,
        platformId: context.platformId,
        communityId: context.communityId,
        timestamp: dayjs().valueOf(),
        text: context.summary,
        startDate: context.startDate,
        endDate: context.endDate,
        summarizationScore,
        coverageScore,
        alignmentScore,
        summarizationReason,
      };

      // Store in vector store
      await vectorStore.upsert({
        indexName: "summaries",
        vectors: [embedding.embedding],
        metadata: [summaryMetadata],
      });

      return {
        success: true,
        summaryId,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Exception saving summary:", error.message);
      } else {
        console.error("Exception saving summary:", error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
