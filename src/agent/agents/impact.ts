import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// Define the schema for structured output
const impactReportSchema = z.object({
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
  keyTopics: z.array(z.object({
    topic: z.string(),
    messageCount: z.number(),
    description: z.string()
  }))
});

export const impactAgent = new Agent({
  name: "impact-report-generator",
  instructions: `You are an impact report generator that analyzes community activity data.
  
  Analyze the provided community data and return a structured report with:
  - Overview statistics (total messages, unique users, active channels)
  - Daily activity breakdown
  - Top contributors
  - Key discussion topics (3-5 main themes)

  For key topics:
  - Identify main discussion themes from the transcript
  - Count approximate mentions/messages for each topic
  - Provide a brief description of each topic
  - Ensure all numbers match the provided statistics`,
  model: openai("gpt-4o"),
});

interface ImpactReportData {
  transcript: string;
  messageCount: number;
  uniqueUserCount: number;
  stats?: {
    messagesByDate: Array<{
      date: string;
      count: number;
      uniqueUsers: number;
    }>;
    topContributors: Array<{
      username: string;
      count: number;
    }>;
    messagesByChannel: Array<{
      channelId: string;
      count: number;
      uniqueUsers: number;
    }>;
  };
}

export async function generateImpactReport(data: ImpactReportData) {
  const statsSection = data.stats ? `
Statistical Context:
- Total Messages: ${data.messageCount}
- Unique Participants: ${data.uniqueUserCount}
- Daily Activity: ${JSON.stringify(data.stats.messagesByDate)}
- Top Contributors: ${JSON.stringify(data.stats.topContributors)}
- Channel Activity: ${JSON.stringify(data.stats.messagesByChannel)}
` : '';

  const prompt = `Analyze this community data and generate a structured report.

${statsSection}

Chat transcript:
${data.transcript}`;

  const result = await impactAgent.generate(prompt, {
    output: impactReportSchema
  });

  return {
    report: result.object
  };
} 