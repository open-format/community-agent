import { vectorStore } from "@/agent/stores";
import { createTool } from "@mastra/core";
import dayjs from "dayjs";
import { Client, GatewayIntentBits } from "discord.js";
import { z } from "zod";

export const getMessagesTool = createTool({
  id: "get-messages",
  description: "Fetch messages from vector store for a specific platform ID and date range",
  inputSchema: z.object({
    platformId: z.string().nonempty(),
    includeStats: z.boolean().optional(),
    includeMessageId: z.boolean().optional(),
    startDate: z.number(),
    endDate: z.number(),
    channelId: z.string().optional(),
    checkedForReward: z.boolean().optional(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
    messages: z.array(
      z.object({
        id: z.string(),
        metadata: z.object({
          timestamp: z.number(),
          authorId: z.string(),
          authorUsername: z.string(),
        }),
      }),
    ),
    stats: z
      .object({
        messageCount: z.number(),
        uniqueUserCount: z.number(),
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
      })
      .optional(),
  }),
  execute: async ({
    context,
  }: {
    context: {
      startDate: number;
      endDate: number;
      platformId: string;
      includeStats?: boolean;
      includeMessageId?: boolean;
      channelId?: string;
      checkedForReward?: boolean;
    };
  }) => {
    try {
      // check if context.checkedForReward is a boolean
      const checkedForReward =
        typeof context.checkedForReward === "boolean" ? context.checkedForReward : undefined;

      // Build filter object with optional channelId
      const filter = {
        platformId: context.platformId,
        $and: [
          { timestamp: { $gte: context.startDate } },
          { timestamp: { $lte: context.endDate } },
        ],
        isBotQuery: {
          $eq: false,
        },
        // only add checkedForReward filter if it is a boolean
        ...(checkedForReward !== undefined ? { checkedForReward: { $eq: checkedForReward } } : {}),
      };

      // Add channelId filter if provided
      if (context.channelId) {
        filter.channelId = context.channelId;
      }

      const queryResults = (await vectorStore.query({
        indexName: "community_messages",
        queryVector: new Array(1536).fill(0),
        topK: 10000,
        includeMetadata: true,
        filter,
      })) as VectorStoreResult[];

      if (queryResults.length === 0) {
        return {
          transcript: `No messages found for platformId "${context.platformId}" in the date range ${context.startDate} to ${context.endDate}.`,
          ...(context.includeStats
            ? {
                stats: {
                  messageCount: 0,
                  uniqueUserCount: 0,
                  messagesByDate: [],
                  topContributors: [],
                  messagesByChannel: [],
                },
              }
            : {}),
        };
      }

      // Sort messages by timestamp (newest first)
      const sortedMessages = queryResults.sort(
        (a, b) => b.metadata.timestamp - a.metadata.timestamp,
      );

      // Generate transcript
      const transcript = await formatMessagesByChannel(
        sortedMessages,
        context.platformId,
        context.includeMessageId,
      );

      // Only calculate stats if requested
      if (context.includeStats) {
        // Track unique users
        const userSet = new Set<string>();
        for (const message of queryResults) {
          if (message.metadata.authorId) {
            userSet.add(message.metadata.authorId);
          }
        }

        // Calculate messages by date
        const dateCountMap = new Map<string, number>();
        // Track unique users by date
        const dateUserMap = new Map<string, Set<string>>();
        // Calculate top contributors
        const contributorCountMap = new Map<string, number>();
        // Calculate messages by channel
        const channelCountMap = new Map<string, number>();
        // Add new map to track unique users per channel
        const channelUserMap = new Map<string, Set<string>>();

        for (const message of sortedMessages) {
          const dateString = dayjs(message.metadata.timestamp).format("YYYY-MM-DD");
          const username = message.metadata.authorUsername || "Unknown User";
          const channelId = message.metadata.channelId;

          // Update date stats
          dateCountMap.set(dateString, (dateCountMap.get(dateString) || 0) + 1);
          if (!dateUserMap.has(dateString)) {
            dateUserMap.set(dateString, new Set<string>());
          }
          if (message.metadata.authorId) {
            dateUserMap.get(dateString)?.add(message.metadata.authorId);
          }

          // Update contributor stats
          contributorCountMap.set(username, (contributorCountMap.get(username) || 0) + 1);

          // Update channel stats
          if (channelId) {
            channelCountMap.set(channelId, (channelCountMap.get(channelId) || 0) + 1);
            if (!channelUserMap.has(channelId)) {
              channelUserMap.set(channelId, new Set<string>());
            }
            if (message.metadata.authorId) {
              channelUserMap.get(channelId)?.add(message.metadata.authorId);
            }
          }
        }

        // Get channel names
        const channelNameMap = await buildChannelNameMap([...channelCountMap.keys()]);

        return {
          transcript,
          messages: queryResults.map((message) => message),
          stats: {
            messageCount: sortedMessages.length,
            uniqueUserCount: userSet.size,
            messagesByDate: Array.from(dateCountMap.entries())
              .map(([date, count]) => ({
                date,
                count,
                uniqueUsers: dateUserMap.get(date)?.size || 0,
              }))
              .sort((a, b) => a.date.localeCompare(b.date)),

            topContributors: Array.from(contributorCountMap.entries())
              .map(([username, count]) => ({ username, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5),

            messagesByChannel: Array.from(channelCountMap.entries())
              .map(([channelId, count]) => ({
                channel: {
                  id: channelId,
                  name: channelNameMap.get(channelId) || "unknown",
                },
                count,
                uniqueUsers: channelUserMap.get(channelId)?.size || 0,
              }))
              .sort((a, b) => b.count - a.count),
          },
        };
      }
      // Just return transcript without stats
      return { transcript, messages: sortedMessages.map((message) => message) };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`No messages found in this community. Details: ${error.message}`);
      }
      throw new Error(`No messages found in this community. Details: ${error}`);
    }
  },
});

// Update the formatting functions
function formatMessagesChronologically(
  messages: VectorStoreResult[],
  platformId: string,
  includeMessageId?: boolean,
): string {
  const header = `The server ID is [${platformId}]\n\n`;

  // Create a structured format that's easier to parse
  const formattedMessages = messages.map((message) => {
    return {
      timestamp: dayjs(message.metadata.timestamp).format("YYYY-MM-DD HH:mm"),
      channelId: message.metadata.channelId || "unknown-channel",
      messageId: message.metadata.messageId,
      username: message.metadata.authorUsername || "Unknown User",
      content: message.metadata.text || "[No content]",
    };
  });

  // Group messages by channel
  const messagesByChannel = formattedMessages.reduce(
    (acc, msg) => {
      if (!acc[msg.channelId]) {
        acc[msg.channelId] = [];
      }
      acc[msg.channelId].push(msg);
      return acc;
    },
    {} as Record<string, typeof formattedMessages>,
  );

  // Format each channel's messages
  const sections = Object.entries(messagesByChannel).map(([channelId, msgs]) => {
    const channelHeader = `=== Messages from Channel with Channel ID: [${channelId}] ===\n`;
    const channelMessages = msgs
      .map((msg) => {
        const messageIdPart = includeMessageId ? ` [DISCORD_MESSAGE_ID=${msg.messageId}]` : "";
        return `[${msg.timestamp}]${messageIdPart} ${msg.username}: ${msg.content}`;
      })
      .join("\n");
    const channelFooter = `=== End of Messages from Channel with Channel ID: [${channelId}] ===\n`;
    return `${channelHeader}${channelMessages}${channelFooter}`;
  });

  return header + sections.join("\n\n");
}

async function formatMessagesByChannel(
  messages: VectorStoreResult[],
  platformId: string,
  includeMessageId?: boolean,
): Promise<string> {
  return formatMessagesChronologically(messages, platformId, includeMessageId);
}

async function buildChannelNameMap(channelIds: string[]): Promise<Map<string, string>> {
  const channelMap = new Map<string, string>();

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise((resolve) => client.once("ready", resolve));

    try {
      // Filter out "unknown-channel" before making API calls
      const validChannelIds = channelIds.filter((id) => id !== "unknown-channel");

      await Promise.all(
        validChannelIds.map(async (channelId) => {
          try {
            const channel = await client.channels.fetch(channelId);
            if (channel && "name" in channel && channel.name) {
              channelMap.set(channelId, channel.name);
            } else {
              channelMap.set(channelId, "unknown");
            }
          } catch (error) {
            console.error(`Failed to fetch channel name for ${channelId}:`, error);
            channelMap.set(channelId, "unknown");
          }
        }),
      );

      // Set unknown-channel explicitly
      channelMap.set("unknown-channel", "Unknown Channel");
    } finally {
      client.destroy();
    }
  } catch (error) {
    console.error("Failed to initialize Discord client:", error);
  }

  return channelMap;
}
