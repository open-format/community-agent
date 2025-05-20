import { vectorStore } from "@/agent/stores";
import { createTool } from "@mastra/core";
import dayjs from "dayjs";
import { z } from "zod";
import { buildChannelNameMap } from "./clients/discord";
import { buildChannelNameMap as buildChannelNameMapTelegram } from "./clients/telegram";

export const getMessagesTool = createTool({
  id: "get-messages",
  description: "Fetch messages from vector store for a specific platform ID and date range",
  inputSchema: z.object({
    platformIds: z.array(
      z.string().nonempty(),
    ),
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
      platformIds: string[];
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
        platformId: context.platformIds,
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
          transcript: `No messages found for platformIds "${context.platformIds.toString()}" in the date range ${context.startDate} to ${context.endDate}.`,
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
      const transcript = await formatMessages(
        sortedMessages,
        context.platformIds,
        context.includeMessageId,
      );

      // Only calculate stats if requested
      if (context.includeStats) {
        // Get an Id for a platform
        const getId = (platform: string, id: string) => platform + ':' + id 

        // Track unique users
        const userSet = new Set<string>();
        for (const message of queryResults) {
          if (message.metadata.authorId && message.metadata.platform) {
            userSet.add(
              getId(message.metadata.platform, message.metadata.authorId)
            );
          }
        }

        // Calculate messages by date
        const dateCountMap = new Map<string, number>();
        // Track unique users by date
        const dateUserMap = new Map<string, Set<string>>();
        // Calculate top contributors
        const contributorCountMap = new Map<string, {username: string, platform: string, count: number}>();
        // Calculate messages by channel
        const channelCountMap = new Map<string, {channel: string, platform: string, count: number}>();
        // Add new map to track unique users per channel
        const channelUserMap = new Map<string, Set<string>>();

        for (const message of sortedMessages) {
          const dateString = dayjs(message.metadata.timestamp).format("YYYY-MM-DD");
          const username = message.metadata.authorUsername || "Unknown User";
          const channelId = message.metadata.channelId;
          const platform = message.metadata.platform;

          const platformUsername = getId(platform, username);
          const platformChannel = getId(platform, channelId);

          // Update date stats
          dateCountMap.set(dateString, (dateCountMap.get(dateString) || 0) + 1);
          if (!dateUserMap.has(dateString)) {
            dateUserMap.set(dateString, new Set<string>());
          }
          if (message.metadata.authorId && message.metadata.platform) {
            dateUserMap.get(dateString)?.add(
              getId(message.metadata.platform, message.metadata.authorId)
            );
          }

          // Update contributor stats
          contributorCountMap.set(platformUsername, {
            platform,
            username: username,
            count: (contributorCountMap.get(platformUsername)?.count ?? 0) + 1,
          });

          // Update channel stats
          if (channelId) {
            channelCountMap.set(platformChannel, {
              platform,
              channel: channelId,
              count: (channelCountMap.get(platformChannel)?.count ?? 0) + 1,
            });

            if (!channelUserMap.has(platformChannel)) {
              channelUserMap.set(platformChannel, new Set<string>());
            }
            if (message.metadata.authorId) {
              channelUserMap.get(platformChannel)?.add(message.metadata.authorId);
            }
          }
        }

        const platformChannelNameMap = new Map<string, Map<string, string>>();
        platformChannelNameMap.set(
          "discord",
          await buildChannelNameMap( 
            Array.from(channelCountMap.values().filter(v => v.platform == "discord").map( v => v.channel) )
          )
        );
        platformChannelNameMap.set(
          "telegram",
          await buildChannelNameMapTelegram(
            Array.from(channelCountMap.values().filter(v => v.platform == "telegram").map( v => v.channel) )
          )
        );

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
              .map(([k, entry]) => ({ username: entry.username, platform: entry.platform, count: entry.count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5),

            messagesByChannel: Array.from(channelCountMap.entries())
              .map(([k, entry]) => ({
                channel: {
                  id: entry.channel,
                  platform: entry.platform,
                  name: platformChannelNameMap.get(entry.platform)?.get(entry.channel) || "unknown",
                },
                count: entry.count,
                uniqueUsers: channelUserMap.get(getId(entry.platform, entry.channel))?.size || 0,
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
  includeMessageId?: boolean,
): string {
  if (messages.length === 0) {
    return "";
  }
  
  // Create a structured format that's easier to parse
  const formattedMessages = messages.map((message) => {
    return {
      timestamp: dayjs(message.metadata.timestamp).format("YYYY-MM-DD HH:mm"),
      channelId: message.metadata.channelId || "unknown-channel",
      messageId: message.metadata.messageId,
      username: message.metadata.authorUsername || "Unknown User",
      content: message.metadata.text || "[No content]",
      platformId: message.metadata.platformId,
      platform: message.metadata.platform,
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
    const channelHeader = `=== Messages from Channel with: [Channel_ID=${channelId}][Platform=${msgs[0].platform}][Platform_ID=${msgs[0].platformId}] ===`;
    const channelMessages = msgs
      .map((msg) => {
        const messageIdPart = includeMessageId ? ` [MESSAGE_ID=${msg.messageId}]` : "";
        return `[${msg.timestamp}]${messageIdPart} ${msg.username}: ${msg.content}`;
      })
      .join("\n");
    const channelFooter = `\n=== End of Messages from Channel with: [Channel_ID=${channelId}][Platform=${msgs[0].platform}][Platform_ID=${msgs[0].platformId}] ===\n`;
    return `${channelHeader}${channelMessages}${channelFooter}`;
  });

  return sections.join("\n\n");
}

async function formatMessages(
  allMessages: VectorStoreResult[],
  platformIds: string[],
  includeMessageId?: boolean,
): Promise<string> {

  const transcripts = platformIds.map( platformId =>
    formatMessagesChronologically(
      allMessages.filter(  m => m.metadata.platformId == platformId ),
      includeMessageId
    )
  ).join("\n\n");

  return transcripts;
}
