import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { saveSummaryTool, fetchCommunityMessagesTool } from '../tools/index';
import { generateSummary } from '../agents/summary';

// Define the workflow
export const summaryWorkflow = new Workflow({
  name: 'community-summary',
  triggerSchema: z.object({
    startDate: z.date(),
    endDate: z.date(),
    communityId: z.string(),
    platformId: z.string().nonempty()
  }),
});

// Step 1: Fetch messages 
const fetchMessagesStep = new Step({
  id: 'fetchMessages',
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
  }),
  execute: async ({ context }) => {
    if (!fetchCommunityMessagesTool.execute) {
      throw new Error('Fetch messages tool not initialized');
    }
    
    try {
      // Handle both Date objects and ISO string dates
      const startDate = typeof context.triggerData.startDate === 'object' 
        ? context.triggerData.startDate.toISOString()
        : context.triggerData.startDate;
      
      const endDate = typeof context.triggerData.endDate === 'object'
        ? context.triggerData.endDate.toISOString()
        : context.triggerData.endDate;

      // Call our fetchCommunityMessagesTool directly with trigger data
      const result = await fetchCommunityMessagesTool.execute({
        context: {
          communityId: context.triggerData.communityId,
          startDate,
          endDate,
          platformId: context.triggerData.platformId
        }
      });

      return result;
    } catch (error: any) {
      console.error('Error in fetchMessagesStep:', error);
      // Instead of throwing, return a transcript indicating no messages
      return {
        transcript: `No messages found. Note: ${error.message}`,
        messageCount: 0,
        uniqueUserCount: 0
      };
    }
  },
});

// Step 2: Generate summary from transcript using the agent
const generateSummaryStep = new Step({
  id: 'generateSummary',
  outputSchema: z.object({
    summary: z.string(),
   // summarizationResult: z.any(),
  }),
  execute: async ({ context }) => {
    if (context.steps.fetchMessages.status !== 'success') {
      throw new Error('Failed to fetch messages');
    }

    const transcript = context.steps.fetchMessages.output.transcript;
    
    // Use the agent to generate the summary
    const result = await generateSummary(transcript);
    
    return result;
  },
});

// Step 3: Save the summary to the database
const saveSummaryStep = new Step({
  id: 'saveSummary',
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    if (context.steps.generateSummary.status !== 'success') {
      throw new Error('Failed to generate summary');
    }
    
    if (context.steps.fetchMessages.status !== 'success') {
      throw new Error('Failed to fetch messages');
    }

    if (!saveSummaryTool.execute) {
      throw new Error('Save summary tool not initialized');
    }

    // Get the start and end dates
    const startDate = typeof context.triggerData.startDate === 'object' 
      ? context.triggerData.startDate.toISOString()
      : context.triggerData.startDate;
    
    const endDate = typeof context.triggerData.endDate === 'object'
      ? context.triggerData.endDate.toISOString()
      : context.triggerData.endDate;

    // Create the context with required fields
    const saveContext = {
      communityId: context.triggerData.communityId,
      summary: context.steps.generateSummary.output.summary,
      startDate,
      endDate,
      platformId: context.triggerData.platformId,
      messageCount: context.steps.fetchMessages.output.messageCount,
      uniqueUserCount: context.steps.fetchMessages.output.uniqueUserCount,
      summarizationResult: context.steps.generateSummary.output.summarizationResult
    };

    return saveSummaryTool.execute({
      context: saveContext
    });
  },
});

// Link the steps together
summaryWorkflow
  .step(fetchMessagesStep)
  .then(generateSummaryStep)
  .then(saveSummaryStep)
  .commit(); 