import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { fetchCommunityMessagesTool } from '../tools/index';
import { generateImpactReport } from '../agents/impact';

interface WorkflowContext {
  triggerData: {
    startDate: Date | string;
    endDate: Date | string;
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
  };
}

export const impactReportWorkflow = new Workflow({
  name: 'community-impact-report',
  triggerSchema: z.object({
    startDate: z.date(),
    endDate: z.date(),
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
      const startDate = typeof context.triggerData.startDate === 'object' 
        ? context.triggerData.startDate.toISOString()
        : context.triggerData.startDate;
      
      const endDate = typeof context.triggerData.endDate === 'object'
        ? context.triggerData.endDate.toISOString()
        : context.triggerData.endDate;

      const result = await fetchCommunityMessagesTool.execute({
        context: {
          startDate,
          endDate,
          platformId: context.triggerData.platformId,
          includeStats: true
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

// Link the steps together
impactReportWorkflow
  .step(fetchMessagesStep)
  .then(generateReportStep)
  .commit(); 