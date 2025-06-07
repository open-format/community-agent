import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { embed } from "ai";
import { z } from "zod";

export const saveImpactReportTool = createTool({
  id: "save-impact-report",
  description: "Save an impact report to the database with vector embeddings",
  inputSchema: z.object({
    report: z.object({
      startDate: z.number(),
      endDate: z.number(),
      platformId: z.string(),
      summaryId: z.string().optional(),
      overview: z.object({
        totalMessages: z.number(),
        uniqueUsers: z.number(),
        activeChannels: z.number(),
      }),
      dailyActivity: z.array(
        z.object({
          date: z.string(),
          messageCount: z.number(),
          uniqueUsers: z.number(),
        }),
      ),
      topContributors: z.array(
        z.object({
          username: z.string(),
          platform: z.string(),
          messageCount: z.number(),
        }),
      ),
      channelBreakdown: z.array(
        z.object({
          channelName: z.string(),
          platform: z.string(),
          messageCount: z.number(),
          uniqueUsers: z.number(),
        }),
      ),
      keyTopics: z.array(
        z.object({
          topic: z.string(),
          messageCount: z.number(),
          description: z.string(),
          evidence: z.array(z.string()),
        }),
      ),
      userSentiment: z.object({
        excitement: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z.array(z.string()),
          }),
        ),
        frustrations: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z.array(z.string()),
          }),
        ),
      }),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({
    context,
  }: {
    context: {
      report: {
        overview: ImpactReportOverview;
        dailyActivity: DailyActivity[];
        topContributors: TopContributor[];
        channelBreakdown: ChannelBreakdown[];
        keyTopics: KeyTopic[];
        userSentiment: UserSentiment;
      };
      startDate: number;
      endDate: number;
      platformId?: string;
      communityId?: string;
      summaryId?: string;
    };
  }) => {
    try {
      const reportId = crypto.randomUUID();
      const reportText = JSON.stringify(context.report);

      const embedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: reportText,
      });

      const reportMetadata: ImpactReportMetadata = {
        platformId: context.platformId,
        communityId: context.communityId,
        timestamp: Date.now(),
        startDate: context.startDate,
        endDate: context.endDate,
        overview: context.report.overview,
        dailyActivity: context.report.dailyActivity,
        topContributors: context.report.topContributors,
        channelBreakdown: context.report.channelBreakdown,
        keyTopics: context.report.keyTopics,
        userSentiment: context.report.userSentiment,
        summaryId: context.summaryId,
        messageCount: context.report.overview.totalMessages,
        uniqueUserCount: context.report.overview.uniqueUsers,
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
