import { google } from "@ai-sdk/google";
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
    evidence: z.array(z.object({
      channelId: z.string(),
      messageId: z.string()
    })).min(2).max(5)
  })),
  userSentiment: z.object({
    excitement: z.array(z.object({
      title: z.string(),
      description: z.string(),
      users: z.array(z.string()),
      evidence: z.array(z.object({
        channelId: z.string(),
        messageId: z.string()
      })).min(1).max(5)
    })),
    frustrations: z.array(z.object({
      title: z.string(),
      description: z.string(),
      users: z.array(z.string()),
      evidence: z.array(z.object({
        channelId: z.string(),
        messageId: z.string()
      })).min(1).max(5)
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

  For Message Examples as evidence:
  1. Extract the channel ID from the channel section header: === Messages from Channel with Channel ID: [channelId] ===
  2. Extract the message ID from the message: [DISCORD_MESSAGE_ID=messageId]
  3. Return them in the evidence array as objects with channelId and messageId

  Example:
  From transcript:
  === Messages from Channel with Channel ID: [987654321] ===
  [2024-03-20] [DISCORD_MESSAGE_ID=111222333] username: content

  Should become:
  evidence: [{ "channelId": "987654321", "messageId": "111222333" }]

  - Only use channel IDs that appear in channel headers === Messages from Channel with Channel ID: [channelId] ===
  - Use the appropriate message IDs for the message you are referencing
  - Never modify or make up IDs
  - Use fewer examples if you can't find enough relevant messages

  For Key Topics:
  - Identify 5-10 main discussion themes, as many as are relevant to the community
  - These should be the most important topics that the community is discussing
  - Prioritise topics that are being discussed by a lot of different people
  - This should be a mix of specific topics and more general topics
  - For each topic, find 2-5 relevant message examples as evidence
  - Include accurate message counts for the number of messages discussing each topic

  For User Sentiment:
  - Identify 5-10 key points of excitement and frustration
  - Don't include the sentiment word in the title, just use the topic (no 'excitement', no 'frustration')
  - Be specific about what the users are excited or frustrated about, specific examples are better
  - Use the surrounding context of the message to provide more specificity
  - If you cant be specific, and you can't use the surrounding context to be specific, then don't include the sentiment
  - The sentiment should be based on the actual content of the messages, they don't need to specifically mention the sentiment word
  - Include the actual usernames of people involved
  - Include 1-3 relevant message examples as evidence
  - Use different messages for each sentiment point
  - Make sure each example is relevant to the sentiment being described
  - If you are going to mentione a specific user, make sure they actually sent or are mentioned in the message

  GOOD EXAMPLES OF TITLES:
  - Authentication Issues with Privy
  - Speed of the new release
  - userRewardAppStats is now working in the subgraph

  AVOID THESE BAD EXAMPLES OF TITLES:
  - Frustration Over Technical Issues
  - Excitement Over Something Working
  - Something Working
  - Something Sorted
  - Issue Resolved
  

  For Channel Breakdown:
  - Use the channel names provided in the channel headers
  - Include accurate message counts and unique user counts per channel

  Remember: Quality over quantity - it's better to have fewer examples with correct IDs than many examples with incorrect or reused message IDs.`,
  model: google("gemini-2.0-flash-001"),
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