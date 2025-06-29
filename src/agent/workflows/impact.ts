import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { logger } from "@/services/logger";
import { Step, Workflow } from "@mastra/core/workflows";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateImpactReport, generateSummary } from "../agents/index";
import { getMessageUrlForPlatform } from "../tools/clients";
import { getMessagesTool, saveImpactReportTool, saveSummaryTool } from "../tools/index";

interface WorkflowContext {
  triggerData: {
    startDate: number;
    endDate: number;
    platformId: string;
    communityId: string;
  };
  steps: {
    fetchMessages: {
      status: string;
      output: {
        transcript: string;
        messageCount: number;
        uniqueUserCount: number;
        hasMessages: boolean;
        stats?: {
          messageCount: number;
          uniqueUserCount: number;
          messagesByDate: Array<{ date: string; count: number; uniqueUsers: number }>;
          topContributors: Array<{ username: string; platform: string; count: number }>;
          messagesByChannel: Array<{
            channel: {
              id: string;
              name: string;
              platform: string;
            };
            count: number;
            uniqueUsers: number;
          }>;
        };
      };
    };
    generateReport: {
      status: string;
      output: {
        report: {
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
            evidence: Array<{
              channelId: string;
              platform: string;
              platformId: string;
              messageId: string;
            }>;
          }>;
          userSentiment: {
            excitement: Array<{
              title: string;
              description: string;
              users: string[];
              evidence: Array<{
                channelId: string;
                platform: string;
                platformId: string;
                messageId: string;
              }>;
            }>;
            frustrations: Array<{
              title: string;
              description: string;
              users: string[];
              evidence: Array<{
                channelId: string;
                platform: string;
                platformId: string;
                messageId: string;
              }>;
            }>;
          };
        };
      };
    };
    generateSummary: {
      status: string;
      output: {
        summary: string;
      };
    };
    saveSummary: {
      status: string;
      output: {
        success: boolean;
        summaryId?: string;
        skipped?: boolean;
      };
    };
    saveReport: {
      status: string;
      output: {
        success: boolean;
        reportId?: string;
        skipped?: boolean;
      };
    };
  };
}

export const impactReportWorkflow = new Workflow({
  name: "community-impact-report",
  triggerSchema: z.object({
    startDate: z.number().refine((val) => {
      const digits = Math.floor(Math.log10(val)) + 1;
      return digits === 10 || digits === 13;
    }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
    endDate: z.number().refine((val) => {
      const digits = Math.floor(Math.log10(val)) + 1;
      return digits === 10 || digits === 13;
    }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
    platformId: z.string().optional(),
    communityId: z.string(),
  }),
});

// Step 1: Fetch messages with stats
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    hasMessages: z.boolean(),
    stats: z
      .object({
        messagesByDate: z.array(
          z.object({
            date: z.string(),
            count: z.number(),
            uniqueUsers: z.number(),
          }),
        ),
        topContributors: z.array(
          z.object({
            username: z.string(),
            count: z.number(),
          }),
        ),
        messagesByChannel: z.array(
          z.object({
            channel: z.object({
              id: z.string(),
              name: z.string(),
            }),
            count: z.number(),
            uniqueUsers: z.number(),
          }),
        ),
        activityByHour: z.array(
          z.object({
            hour: z.number(),
            count: z.number(),
            uniqueUsers: z.number(),
          }),
        ),
        activityByDayOfWeek: z.array(
          z.object({
            day: z.string(),
            count: z.number(),
            uniqueUsers: z.number(),
          }),
        ),
      })
      .optional(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    try {
      // Convert to milliseconds if in seconds
      const startDate =
        context.triggerData.startDate.toString().length === 10
          ? context.triggerData.startDate * 1000
          : context.triggerData.startDate;

      const endDate =
        context.triggerData.endDate.toString().length === 10
          ? context.triggerData.endDate * 1000
          : context.triggerData.endDate;

      const platformIds: string[] = [];
      if (context.triggerData.platformId) {
        // Report is for a specific platform, just add it to the ids to fetch
        platformIds.push(context.triggerData.platformId);
      } else {
        // Report is for a community, get all platforms and add them to the
        //  ids to fetch
        const platforms = await db
          .select()
          .from(platformConnections)
          .where(eq(platformConnections.communityId, context.triggerData.communityId));
        if (platforms.length === 0) {
          throw new Error("No platform connections found.");
        }
        platforms.forEach((p) => platformIds.push(p.platformId));
      }

      if (!getMessagesTool.execute) {
        throw new Error("Fetch messages tool not initialized");
      }

      const result = await getMessagesTool.execute({
        context: {
          startDate,
          endDate,
          platformIds,
          includeStats: true,
          includeMessageId: true,
        },
      });

      const messageCount = result.stats?.messageCount || 0;
      const hasMessages = messageCount > 0;

      if (!hasMessages) {
        logger.info(
          {
            platformId: context.triggerData.platformId,
            communityId: context.triggerData.communityId,
            messageCount,
            startDate: context.triggerData.startDate,
            endDate: context.triggerData.endDate,
          },
          "No messages found in date range - workflow will skip expensive operations",
        );
      }

      return {
        ...result,
        hasMessages,
      };
    } catch (error: any) {
      console.error("Error in fetchMessagesStep:", error);
      throw error;
    }
  },
});

// Step 2: Generate impact report
const generateReportStep = new Step({
  id: "generateReport",
  outputSchema: z.object({
    report: z.object({
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
          evidence: z.array(
            z.object({
              channelId: z.string(),
              platform: z.string(),
              platformId: z.string(),
              messageId: z.string(),
            }),
          ),
        }),
      ),
      userSentiment: z.object({
        excitement: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z.array(
              z.object({
                channelId: z.string(),
                platform: z.string(),
                platformId: z.string(),
                messageId: z.string(),
              }),
            ),
          }),
        ),
        frustrations: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z.array(
              z.object({
                channelId: z.string(),
                platform: z.string(),
                platformId: z.string(),
                messageId: z.string(),
              }),
            ),
          }),
        ),
      }),
    }),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    // Skip report generation if no messages
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping impact report generation - no messages to analyze");
      return {
        report: {
          overview: {
            totalMessages: 0,
            uniqueUsers: 0,
            activeChannels: 0,
          },
          dailyActivity: [],
          topContributors: [],
          channelBreakdown: [],
          keyTopics: [],
          userSentiment: {
            excitement: [],
            frustrations: [],
          },
        },
      };
    }

    const messageData = context.steps.fetchMessages.output;
    return generateImpactReport(messageData);
  },
});

// Step 3: Generate summary
const generateSummaryStep = new Step({
  id: "generateSummary",
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    // Skip summary generation if no messages
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping summary generation - no messages to summarize");
      return {
        summary: "No messages found in the specified date range.",
      };
    }

    const transcript = context.steps.fetchMessages.output.transcript;
    return generateSummary(transcript);
  },
});

// Add saveSummary step
const saveSummaryStep = new Step({
  id: "saveSummary",
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
    skipped: z.boolean().optional(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (
      context.steps.generateSummary.status !== "success" ||
      context.steps.fetchMessages.status !== "success"
    ) {
      throw new Error("Summary generation and message fetch must complete successfully");
    }

    // Skip saving if no messages
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping summary save - no messages to report on");
      return {
        success: true,
        skipped: true,
      };
    }

    if (!saveSummaryTool.execute) {
      throw new Error("Save summary tool not initialized");
    }

    const result = await saveSummaryTool.execute({
      context: {
        summary: context.steps.generateSummary.output.summary,
        startDate: context.triggerData.startDate,
        endDate: context.triggerData.endDate,
        platformId: context.triggerData.platformId,
        communityId: context.triggerData.communityId,
      },
    });

    return {
      ...result,
      skipped: false,
    };
  },
});

// Add saveReport step
const saveReportStep = new Step({
  id: "saveReport",
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid().optional(),
    skipped: z.boolean().optional(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (
      context.steps.generateReport.status !== "success" ||
      context.steps.saveSummary.status !== "success"
    ) {
      throw new Error("Report generation and summary save must complete successfully");
    }

    // Skip saving if no messages
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping report save - no messages to report on");
      return {
        success: true,
        skipped: true,
      };
    }

    if (!saveImpactReportTool.execute) {
      throw new Error("Save report tool not initialized");
    }

    // Transform the stats from getMessages into the format expected by saveImpactReport
    const messagesStats = context.steps.fetchMessages.output.stats;
    if (!messagesStats) {
      throw new Error("No message stats available");
    }

    // Get the report from generateReport step (it's already an object)
    const generatedReport = context.steps.generateReport.output.report;

    const report = {
      overview: {
        totalMessages: messagesStats.messageCount,
        uniqueUsers: messagesStats.uniqueUserCount,
        activeChannels: messagesStats.messagesByChannel.length,
      },
      dailyActivity: messagesStats.messagesByDate.map((day) => ({
        date: day.date,
        messageCount: day.count,
        uniqueUsers: day.uniqueUsers,
      })),
      topContributors: messagesStats.topContributors.map((contributor) => ({
        username: contributor.username,
        platform: contributor.platform,
        messageCount: contributor.count,
      })),
      channelBreakdown: messagesStats.messagesByChannel.map((channel) => ({
        channelName: channel.channel.name,
        platform: channel.channel.platform,
        messageCount: channel.count,
        uniqueUsers: channel.uniqueUsers,
      })),
      keyTopics: generatedReport.keyTopics.map((topic) => ({
        ...topic,
        evidence: topic.evidence.map((evidence) =>
          getMessageUrlForPlatform(
            evidence.platform,
            evidence.platformId,
            evidence.channelId,
            evidence.messageId,
          ),
        ),
      })),
      userSentiment: {
        excitement: generatedReport.userSentiment.excitement.map((item) => ({
          ...item,
          evidence: item.evidence.map((evidence) =>
            getMessageUrlForPlatform(
              evidence.platform,
              evidence.platformId,
              evidence.channelId,
              evidence.messageId,
            ),
          ),
        })),
        frustrations: generatedReport.userSentiment.frustrations.map((item) => ({
          ...item,
          evidence: item.evidence.map((evidence) =>
            getMessageUrlForPlatform(
              evidence.platform,
              evidence.platformId,
              evidence.channelId,
              evidence.messageId,
            ),
          ),
        })),
      },
    };

    const result = await saveImpactReportTool.execute({
      context: {
        report,
        startDate: context.triggerData.startDate,
        endDate: context.triggerData.endDate,
        platformId: context.triggerData.platformId,
        communityId: context.triggerData.communityId,
        summaryId: context.steps.saveSummary.output.summaryId,
      },
    });

    return {
      ...result,
      skipped: false,
    };
  },
});

// Update the workflow chain
impactReportWorkflow
  .step(fetchMessagesStep)
  .then(generateReportStep)
  .then(generateSummaryStep)
  .then(saveSummaryStep)
  .then(saveReportStep)
  .commit();
