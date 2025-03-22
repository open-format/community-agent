import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { vectorStore } from '@/agent/stores';
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

interface ImpactReportMetadata {
  platformId: string;
  timestamp: number; 
  startDate: number; 
  endDate: number; 
  messageCount: number;
  uniqueUserCount: number;
  overview: {
    totalMessages: number;
    uniqueUsers: number;
    activeChannels: number;
  };
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    uniqueUsers: number;
  }>;
  topContributors: Array<{
    username: string;
    messageCount: number;
  }>;
  channelBreakdown: Array<{
    channelName: string;
    messageCount: number;
    uniqueUsers: number;
  }>;
  keyTopics: Array<{
    topic: string;
    messageCount: number;
    description: string;
    examples: string[];
  }>;
  userSentiment: {
    excitement: Array<{
      title: string;
      description: string;
      users: string[];
      examples: string[];
    }>;
    frustrations: Array<{
      title: string;
      description: string;
      users: string[];
      examples: string[];
    }>;
  };
  summaryId?: string;
}

export const saveImpactReportTool = createTool({
  id: "save-impact-report",
  description: "Save an impact report to the database with vector embeddings",
  inputSchema: z.object({
    communityId: z.string(),
    report: z.object({
      overview: z.object({
        totalMessages: z.number(),
        uniqueUsers: z.number(),
        activeChannels: z.number()
      }),
      dailyActivity: z.array(z.object({
        date: z.string(),
        messageCount: z.number(),
        uniqueUsers: z.number()
      })),
      topContributors: z.array(z.object({
        username: z.string(),
        messageCount: z.number()
      })),
      channelBreakdown: z.array(z.object({
        channelName: z.string(),
        messageCount: z.number(),
        uniqueUsers: z.number()
      })),
      keyTopics: z.array(z.object({
        topic: z.string(),
        messageCount: z.number(),
        description: z.string(),
        examples: z.array(z.string())
      })),
      userSentiment: z.object({
        excitement: z.array(z.object({
          title: z.string(),
          description: z.string(),
          users: z.array(z.string()),
          examples: z.array(z.string())
        })),
        frustrations: z.array(z.object({
          title: z.string(),
          description: z.string(),
          users: z.array(z.string()),
          examples: z.array(z.string())
        }))
      })
    }),
    startDate: z.string(),
    endDate: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    platformId: z.string(),
    summaryId: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }: { context: any }) => {
    try {
      const reportId = crypto.randomUUID();
      const reportText = JSON.stringify(context.report);

      const embedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: reportText,
      });

      const reportMetadata: ImpactReportMetadata = {
        platformId: context.platformId,
        timestamp: Math.floor(new Date(context.startDate).getTime() / 1000),
        startDate: Math.floor(new Date(context.startDate).getTime() / 1000),
        endDate: Math.floor(new Date(context.endDate).getTime() / 1000),
        messageCount: context.messageCount,
        uniqueUserCount: context.uniqueUserCount,
        overview: context.report.overview,
        dailyActivity: context.report.dailyActivity,
        topContributors: context.report.topContributors,
        channelBreakdown: context.report.channelBreakdown,
        keyTopics: context.report.keyTopics,
        userSentiment: context.report.userSentiment,
        summaryId: context.summaryId,
      };

      await vectorStore.upsert({
        indexName: "impact_reports",
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