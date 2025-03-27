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
  channelBreakdown: z.array(z.object({
    channelName: z.string(),
    messageCount: z.number(),
    uniqueUsers: z.number()
  })),
  keyTopics: z.array(z.object({
    topic: z.string(),
    messageCount: z.number(),
    description: z.string(),
    examples: z.array(z.string()).min(1).max(5)
  })),
  userSentiment: z.object({
    excitement: z.array(z.object({
      title: z.string(),
      description: z.string(),
      users: z.array(z.string()),
      examples: z.array(z.string()).min(1).max(5)
    })),
    frustrations: z.array(z.object({
      title: z.string(),
      description: z.string(),
      users: z.array(z.string()),
      examples: z.array(z.string()).min(1).max(5)
    }))
  })
});

export const impactAgent = new Agent({
  name: "impact-report-generator",
  instructions: `You are an impact report generator that analyzes community activity data.
  
  Analyze the provided community data and return a structured report with:
  - Overview statistics (total messages, unique users, active channels)
  - Daily activity breakdown
  - Top contributors
  - Channel activity breakdown (messages and unique users per channel)
  - Key discussion topics (5-10 main themes)
  - User sentiment analysis (what excites and frustrates users, 5-10 key points for each)

  CRITICAL - Message URL Format:
  Messages in the transcript are organized by channel and follow this format:
  === Messages from Channel ID: [channelId] (Channel name: channelName) ===
  [timestamp] [DISCORD_MESSAGE_ID=messageId] username: content

  The server ID is provided at the start of the transcript as: The server ID is [serverId]

  When referencing messages:
  1. Extract the server ID from the transcript header
  2. Extract the channel ID from the channel section header: [channelId]
  3. Extract the message ID from the message: [DISCORD_MESSAGE_ID=messageId]
  4. Construct the full Discord URL using this format:
     https://discord.com/channels/[serverId]/[channelId]/[messageId]

  Example:
  From transcript:
  The server ID is [123456789]
  === Messages from Channel ID: [987654321] ===
  [2024-03-20] [DISCORD_MESSAGE_ID=111222333] username: content

  Should become:
  https://discord.com/channels/123456789/987654321/111222333

  Rules for Message References:
  - Only use message IDs that appear in [DISCORD_MESSAGE_ID=xxx] format
  - Only use channel IDs that appear in channel headers [channelId]
  - Never reuse a message ID
  - Never modify or make up IDs
  - Use fewer examples if you can't find enough relevant messages
  - Always construct complete, valid Discord URLs

  For Key Topics:
  - Identify 5-10 main discussion themes, as many as are relevant to the community
  - These should be the most important topics that the community is discussing
  - Prioritise topics that are being discussed by a lot of different people
  - This should be a mix of specific topics and more general topics
  - For each topic, find 1-3 relevant message examples
  - Include full Discord URLs to the example messages
  - Include accurate message counts for the number of messages discussing each topic

  For User Sentiment:
  - Identify 5-10 key points of excitement and frustration
  - Be specific about what the users are excited or frustrated about, specific examples are better
  - The sentiment should be based on the actual content of the messages, they don't need to specifically mention the sentiment word
  - Include the actual usernames of people involved
  - Include full Discord URLs to example messages
  - Use different messages for each sentiment point
  - Make sure each example is relevant to the sentiment being described

  For Channel Breakdown:
  - Use the channel names provided in the channel headers
  - Include accurate message counts and unique user counts per channel

  Remember: Quality over quantity - it's better to have fewer examples with correct URLs than many examples with incorrect or reused message IDs.`,
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
      channel: {
        id: string;
        name: string;
      };
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