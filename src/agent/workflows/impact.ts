import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { generateImpactReport } from '../agents/impact';
import { generateSummary } from '../agents/summary';
import { saveSummaryTool, saveImpactReportTool, getMessagesTool } from '../tools/index';

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
        stats?: {
          messagesByDate: Array<{ date: string; count: number; uniqueUsers: number }>;
          topContributors: Array<{ username: string; count: number }>;
          messagesByChannel: Array<{ 
            channel: {
              id: string;
              name: string;
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
        report: string;
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
      };
    };
    saveReport: {
      status: string;
      output: {
        success: boolean;
        reportId?: string;
      };
    };
  };
}

export const impactReportWorkflow = new Workflow({
  name: 'community-impact-report',
  triggerSchema: z.object({
    startDate: z.number()
      .refine(val => {
        const digits = Math.floor(Math.log10(val)) + 1;
        return digits === 10 || digits === 13;
      }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
    endDate: z.number()
      .refine(val => {
        const digits = Math.floor(Math.log10(val)) + 1;
        return digits === 10 || digits === 13;
      }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
    platformId: z.string().nonempty(),
    communityId: z.string().nonempty()
  }),
});

// Step 1: Fetch messages with stats
const fetchMessagesStep = new Step({
  id: 'fetchMessages',
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    stats: z.object({
      messagesByDate: z.array(z.object({
        date: z.string(),
        count: z.number(),
        uniqueUsers: z.number()
      })),
      topContributors: z.array(z.object({
        username: z.string(),
        count: z.number()
      })),
      messagesByChannel: z.array(z.object({
        channel: z.object({
          id: z.string(),
          name: z.string()
        }),
        count: z.number(),
        uniqueUsers: z.number()
      })),
      activityByHour: z.array(z.object({
        hour: z.number(),
        count: z.number(),
        uniqueUsers: z.number()
      })),
      activityByDayOfWeek: z.array(z.object({
        day: z.string(),
        count: z.number(),
        uniqueUsers: z.number()
      }))
    }).optional()
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    try {
      // Convert to milliseconds if in seconds
      const startDate = context.triggerData.startDate.toString().length === 10 
        ? context.triggerData.startDate * 1000 
        : context.triggerData.startDate;
      
      const endDate = context.triggerData.endDate.toString().length === 10
        ? context.triggerData.endDate * 1000
        : context.triggerData.endDate;

      if (!getMessagesTool.execute) {
        throw new Error('Fetch messages tool not initialized');
      }

      const result = await getMessagesTool.execute({
        context: {
          startDate,
          endDate,
          platformId: context.triggerData.platformId,
          includeStats: true,
          includeMessageId: true
        }
      });

      return result;
    } catch (error: any) {
      console.error('Error in fetchMessagesStep:', error);
      throw error;
    }
  },
});

// Step 2: Generate impact report
const generateReportStep = new Step({
  id: 'generateReport',
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.fetchMessages.status !== 'success') {
      throw new Error('Failed to fetch messages');
    }

    const messageData = context.steps.fetchMessages.output;
    
    return generateImpactReport(messageData);
  },
});

// Step 3: Generate summary
const generateSummaryStep = new Step({
  id: 'generateSummary',
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.fetchMessages.status !== 'success') {
      throw new Error('Failed to fetch messages');
    }

    const transcript = context.steps.fetchMessages.output.transcript;
    return generateSummary(transcript);
  },
});

// Add saveSummary step
const saveSummaryStep = new Step({
  id: 'saveSummary',
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.generateSummary.status !== 'success' || 
        context.steps.fetchMessages.status !== 'success') {
      throw new Error('Summary generation and message fetch must complete successfully');
    }

    if (!saveSummaryTool.execute) {
      throw new Error('Save summary tool not initialized');
    }

    return saveSummaryTool.execute({
      context: {
        communityId: context.triggerData.communityId,
        summary: context.steps.generateSummary.output.summary,
        startDate: context.triggerData.startDate,
        endDate: context.triggerData.endDate,
        messageCount: context.steps.fetchMessages.output.messageCount,
        uniqueUserCount: context.steps.fetchMessages.output.uniqueUserCount,
        platformId: context.triggerData.platformId
      }
    });
  }
});

// Add saveReport step
const saveReportStep = new Step({
  id: 'saveReport',
  outputSchema: z.object({
    success: z.boolean(),
    reportId: z.string().uuid().optional(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.generateReport.status !== 'success' || 
        context.steps.saveSummary.status !== 'success') {
      throw new Error('Report generation and summary save must complete successfully');
    }

    if (!saveImpactReportTool.execute) {
      throw new Error('Save report tool not initialized');
    }

    return saveImpactReportTool.execute({
      context: {
        communityId: context.triggerData.communityId,
        report: context.steps.generateReport.output.report,
        startDate: context.triggerData.startDate.toString(),
        endDate: context.triggerData.endDate.toString(),
        messageCount: context.steps.fetchMessages.output.messageCount,
        uniqueUserCount: context.steps.fetchMessages.output.uniqueUserCount,
        platformId: context.triggerData.platformId,
        summaryId: context.steps.saveSummary.output.summaryId
      }
    });
  }
});

// Update the workflow chain
impactReportWorkflow
  .step(fetchMessagesStep)
  .then(generateReportStep)
  .then(generateSummaryStep)
  .then(saveSummaryStep)
  .then(saveReportStep)
  .commit(); 