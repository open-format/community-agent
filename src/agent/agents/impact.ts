import { logger } from "@/services/logger";
import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// Define the schema for structured output
const impactReportSchema = z.object({
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
      messageCount: z.number(),
    }),
  ),
  channelBreakdown: z.array(
    z.object({
      channelName: z.string(),
      messageCount: z.number(),
      uniqueUsers: z.number(),
    }),
  ),
  keyTopics: z.array(
    z.object({
      topic: z.string(),
      messageCount: z.number(),
      description: z.string(),
      evidence: z
        .array(
          z.object({
            channelId: z.string(),
            platform: z.string(),
            platformId: z.string(),
            messageId: z.string(),
          }),
        )
        .min(1)
        .max(5),
    }),
  ),
  userSentiment: z.object({
    excitement: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        users: z.array(z.string()),
        evidence: z
          .array(
            z.object({
              channelId: z.string(),
              platform: z.string(),
              platformId: z.string(),
              messageId: z.string(),
            }),
          )
          .min(1)
          .max(5),
      }),
    ),
    frustrations: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        users: z.array(z.string()),
        evidence: z
          .array(
            z.object({
              channelId: z.string(),
              platform: z.string(),
              platformId: z.string(),
              messageId: z.string(),
            }),
          )
          .min(1)
          .max(5),
      }),
    ),
  }),
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
  1. Extract the channel ID from the channel section header: === Messages from Channel with: [Channel_ID=channelId][Platform=platform][Platform_ID=platformId] ===
  2. Extract the Platform ID from the channel section header: === Messages from Channel with: [Channel_ID=channelId][Platform=platform][Platform_ID=platformId] ===
  3. Extract the Platform (discord or telegram) from the channel section header: === Messages from Channel with: [Channel_ID=channelId][Platform=platform][Platform_ID=platformId] ===
  4. Extract the message ID from the message: [MESSAGE_ID=messageId]
  5. Return them in the evidence array as objects with channelId, platformId, platform and messageId

  Example:
  From transcript:
  === Messages from Channel with Channel ID: [Channel_ID=987654321][Platform=discord][Platform_ID=1368807851945889903] ===
  [2024-03-20] [MESSAGE_ID=111222333] username: content

  Should become:
  evidence: [{ "channelId": "987654321", "platform": "discord", "platformId": "1368807851945889903", "messageId": "111222333" }]

  - Only use channel IDs that appear in channel headers === Messages from Channel with: [Channel_ID=channelId][Platform=platform][Platform_ID=platformId] ===
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
      platform: string;
      count: number;
    }>;
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
}

// Function to estimate token count (same as summary)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3);
}

// Function to chunk transcript into manageable pieces
function chunkTranscript(transcript: string, maxTokensPerChunk = 200000): string[] {
  const chunks: string[] = [];
  const lines = transcript.split("\n");
  let currentChunk = "";
  let currentTokenCount = 0;

  for (const line of lines) {
    const lineTokenCount = estimateTokenCount(line);

    if (currentTokenCount + lineTokenCount > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = `${line}\n`;
      currentTokenCount = lineTokenCount;
    } else {
      currentChunk += `${line}\n`;
      currentTokenCount += lineTokenCount;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Function to generate impact report for a single chunk
async function generateChunkImpactReport(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  stats: any,
): Promise<any> {
  const statsSection = stats
    ? `
Statistical Context:
- Total Messages: ${stats.messageCount}
- Unique Participants: ${stats.uniqueUserCount}
- Daily Activity: ${JSON.stringify(stats.messagesByDate)}
- Top Contributors: ${JSON.stringify(stats.topContributors)}
- Channel Activity: ${JSON.stringify(stats.messagesByChannel)}
`
    : "";

  const prompt = `Analyze this portion of community data (chunk ${chunkIndex + 1} of ${totalChunks}) and generate a structured report.

${statsSection}

Chat transcript portion:
${chunk}

Focus on identifying key topics and user sentiment from this section. Return a simplified structure with just the key topics and user sentiment.`;

  try {
    const chunkSchema = z.object({
      keyTopics: z.array(
        z.object({
          topic: z.string(),
          messageCount: z.number(),
          description: z.string(),
          evidence: z
            .array(
              z.object({
                channelId: z.string(),
                platform: z.string(),
                platformId: z.string(),
                messageId: z.string(),
              }),
            )
            .min(1)
            .max(3),
        }),
      ),
      userSentiment: z.object({
        excitement: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z
              .array(
                z.object({
                  channelId: z.string(),
                  platform: z.string(),
                  platformId: z.string(),
                  messageId: z.string(),
                }),
              )
              .min(1)
              .max(3),
          }),
        ),
        frustrations: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            users: z.array(z.string()),
            evidence: z
              .array(
                z.object({
                  channelId: z.string(),
                  platform: z.string(),
                  platformId: z.string(),
                  messageId: z.string(),
                }),
              )
              .min(1)
              .max(3),
          }),
        ),
      }),
    });

    const result = await impactAgent.generate(prompt, {
      output: chunkSchema,
    });

    return result.object;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        chunkIndex,
        totalChunks,
      },
      `Failed to generate impact report for chunk ${chunkIndex + 1}`,
    );

    // Return empty structure for failed chunks
    return {
      keyTopics: [],
      userSentiment: {
        excitement: [],
        frustrations: [],
      },
    };
  }
}

// Function to combine chunk results
async function combineChunkResults(chunkResults: any[], stats: any): Promise<any> {
  // Combine all key topics and user sentiment
  const allKeyTopics = chunkResults.flatMap((result) => result.keyTopics || []);
  const allExcitement = chunkResults.flatMap((result) => result.userSentiment?.excitement || []);
  const allFrustrations = chunkResults.flatMap(
    (result) => result.userSentiment?.frustrations || [],
  );

  // Deduplicate and merge similar topics/sentiments
  const mergedKeyTopics = mergeSimilarTopics(allKeyTopics);
  const mergedExcitement = mergeSimilarSentiments(allExcitement);
  const mergedFrustrations = mergeSimilarSentiments(allFrustrations);

  return {
    overview: {
      totalMessages: stats.messageCount,
      uniqueUsers: stats.uniqueUserCount,
      activeChannels: stats.messagesByChannel.length,
    },
    dailyActivity: stats.messagesByDate,
    topContributors: stats.topContributors,
    channelBreakdown: stats.messagesByChannel.map((ch) => ({
      channelName: ch.channel.name,
      platform: ch.channel.platform,
      messageCount: ch.count,
      uniqueUsers: ch.uniqueUsers,
    })),
    keyTopics: mergedKeyTopics.slice(0, 10), // Limit to top 10
    userSentiment: {
      excitement: mergedExcitement.slice(0, 10), // Limit to top 10
      frustrations: mergedFrustrations.slice(0, 10), // Limit to top 10
    },
  };
}

// Helper function to merge similar topics
function mergeSimilarTopics(topics: any[]): any[] {
  const merged: any[] = [];
  const seen: Set<string> = new Set();

  for (const topic of topics) {
    const key = topic.topic.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(topic);
    }
  }

  return merged.sort((a, b) => b.messageCount - a.messageCount);
}

// Helper function to merge similar sentiments
function mergeSimilarSentiments(sentiments: any[]): any[] {
  const merged: any[] = [];
  const seen: Set<string> = new Set();

  for (const sentiment of sentiments) {
    const key = sentiment.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(sentiment);
    }
  }

  return merged;
}

export async function generateImpactReport(data: ImpactReportData) {
  const totalTokens = estimateTokenCount(data.transcript);
  logger.info({ totalTokens }, "Starting impact report generation");

  // If transcript is small enough, process directly
  if (totalTokens <= 200000) {
    const statsSection = data.stats
      ? `
Statistical Context:
- Total Messages: ${data.messageCount}
- Unique Participants: ${data.uniqueUserCount}
- Daily Activity: ${JSON.stringify(data.stats.messagesByDate)}
- Top Contributors: ${JSON.stringify(data.stats.topContributors)}
- Channel Activity: ${JSON.stringify(data.stats.messagesByChannel)}
`
      : "";

    const prompt = `Analyze this community data and generate a structured report.

${statsSection}

Chat transcript:
${data.transcript}`;

    try {
      const result = await impactAgent.generate(prompt, {
        output: impactReportSchema,
      });

      return {
        report: result.object,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          messageCount: data.messageCount,
          transcriptLength: data.transcript.length,
        },
        "Failed to generate impact report with direct approach",
      );

      // Fall through to chunking approach
    }
  }

  // For large transcripts, use chunking approach
  logger.info({ totalTokens }, "Transcript is large, using chunking approach");

  const chunks = chunkTranscript(data.transcript, 200000);
  logger.info({ chunkCount: chunks.length }, "Split transcript into chunks");

  const chunkResults: any[] = [];

  // Process chunks with retry logic
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        logger.info(
          { chunkIndex: i, totalChunks: chunks.length },
          `Processing impact report chunk ${i + 1}/${chunks.length}`,
        );

        const chunkResult = await generateChunkImpactReport(chunk, i, chunks.length, data.stats);

        chunkResults.push(chunkResult);
        break;
      } catch (error) {
        retries++;
        if (retries < maxRetries) {
          const delay = Math.min(1000 * 2 ** retries, 30000);
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              chunkIndex: i,
              retry: retries,
              delay,
            },
            `Retrying impact report chunk ${i + 1}, attempt ${retries}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              chunkIndex: i,
            },
            `Failed to process impact report chunk ${i + 1} after ${maxRetries} attempts`,
          );
          // Add empty result to maintain array structure
          chunkResults.push({
            keyTopics: [],
            userSentiment: { excitement: [], frustrations: [] },
          });
        }
      }
    }
  }

  // Combine all chunk results into final report
  logger.info({ chunkCount: chunkResults.length }, "Combining impact report chunks");
  const finalReport = await combineChunkResults(chunkResults, data.stats);

  return {
    report: finalReport,
  };
}
