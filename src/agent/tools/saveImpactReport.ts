import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { vectorStore } from '@/agent/stores';
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

interface ImpactReportMetadata {
  platform: string;
  platformId: string;
  timestamp: Date | string;
  text: string;
  type: 'impact-report';
  startDate: string;
  endDate: string;
  messageCount: number;
  uniqueUserCount: number;
}

export const saveImpactReportTool = createTool({
  id: "save-impact-report",
  description: "Save an impact report to the database with vector embeddings",
  inputSchema: z.object({
    communityId: z.string(),
    report: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    platformId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const reportId = crypto.randomUUID();

      const embedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: context.report,
      });

      const reportMetadata: ImpactReportMetadata = {
        platform: "impact-report",
        platformId: context.platformId,
        timestamp: new Date(),
        text: context.report,
        type: 'impact-report',
        startDate: context.startDate,
        endDate: context.endDate,
        messageCount: context.messageCount,
        uniqueUserCount: context.uniqueUserCount
      };

      await vectorStore.upsert({
        indexName: "community_messages",
        vectors: [embedding.embedding],
        metadata: [reportMetadata],
      });

      return {
        success: true,
        reportId,
      };
    } catch (error: any) {
      console.error("Exception saving impact report:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
}); 