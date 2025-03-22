import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core";
import { embed } from "ai";
import { Client, GatewayIntentBits } from 'discord.js';
import dayjs from "dayjs";
import { z } from "zod";

// Define MessageMetadata interface
interface MessageMetadata {
  platform: string;
  platformId: string;
  messageId: string;
  authorId: string;
  authorUsername: string;
  channelId: string;
  threadId: string;
  timestamp: number;
  text: string;
  isReaction: boolean;
  isSummary?: boolean;
}

// Define stats interfaces
interface DateStat {
  date: string;
  count: number;
  uniqueUsers: number;
}

interface ContributorStat {
  username: string;
  count: number;
}

interface ChannelStat {
  channel: {
    id: string;
    name: string;
  };
  count: number;
  uniqueUsers: number;
}

interface MessageStats {
  messagesByDate: DateStat[];
  topContributors: ContributorStat[];
  messagesByChannel: ChannelStat[];
}

// Add VectorStoreResult interface
interface VectorStoreResult {
  metadata: MessageMetadata;
  [key: string]: any;
}

async function buildChannelNameMap(channelIds: string[]): Promise<Map<string, string>> {
  const channelMap = new Map<string, string>();
  
  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));

    try {
      // Filter out "unknown-channel" before making API calls
      const validChannelIds = channelIds.filter(id => id !== 'unknown-channel');
      
      await Promise.all(validChannelIds.map(async (channelId) => {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && 'name' in channel && channel.name) {
            channelMap.set(channelId, channel.name);
          } else {
            channelMap.set(channelId, 'unknown');
          }
        } catch (error) {
          console.error(`Failed to fetch channel name for ${channelId}:`, error);
          channelMap.set(channelId, 'unknown');
        }
      }));

      // Set unknown-channel explicitly
      channelMap.set('unknown-channel', 'Unknown Channel');
    } finally {
      client.destroy();
    }
  } catch (error) {
    console.error('Failed to initialize Discord client:', error);
  }

  return channelMap;
}

export const fetchCommunityMessagesTool = createTool({
  id: "fetch-community-messages",
  description: "Fetch messages from vector store for a specific platform ID and date range",
  inputSchema: z.object({
    platformId: z.string().nonempty(),
    includeStats: z.boolean().optional(),
    formatByChannel: z.boolean().optional(),
    includeMessageId: z.boolean().optional(),
    startDate: z.number(),
    endDate: z.number(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number().optional(),
    uniqueUserCount: z.number().optional(),
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
      }))
    }).optional()
  }),
  execute: async ({ context }: { 
    context: { 
      startDate: number; 
      endDate: number; 
      platformId: string; 
      includeStats?: boolean;
      formatByChannel?: boolean;
      includeMessageId?: boolean;
    } 
  }) => {
    try {
      // Create a dummy embedding for the query
      const dummyEmbedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: "community messages",
      });

      const queryResults = (await vectorStore.query({
        indexName: "community_messages",
        queryVector: dummyEmbedding.embedding,
        topK: 10000,
        includeMetadata: true,
        filter: {
          platformId: context.platformId,
          $and: [
            { timestamp: { $gte: context.startDate } },
            { timestamp: { $lte: context.endDate } },
          ],
          isBotQuery: {
            $eq: false,
          },
        },
      })) as VectorStoreResult[];

      if (queryResults.length === 0) {
        return {
          transcript: `No messages found for platformId "${context.platformId}" in the date range ${context.startDate} to ${context.endDate}.`,
          messageCount: 0,
          uniqueUserCount: 0,
        };
      }

      // Track stats only if requested
      if (context.includeStats) {
        // Track unique users
        const userSet = new Set<string>();
        queryResults.forEach(message => {
          if (message.metadata.authorId) {
            userSet.add(message.metadata.authorId);
          }
        });

        // Sort messages by timestamp (newest first)
        const sortedMessages = queryResults.sort((a, b) => 
          b.metadata.timestamp - a.metadata.timestamp
        );

        // Generate transcript
        const transcript = await formatMessagesByChannel(sortedMessages, context.platformId);

        // Generate stats
        let stats: MessageStats | undefined;
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

        sortedMessages.forEach(message => {
          const dateString = dayjs(message.metadata.timestamp).format('YYYY-MM-DD');
          const username = message.metadata.authorUsername || 'Unknown User';
          const channelId = message.metadata.channelId;

          // Update date stats
          dateCountMap.set(dateString, (dateCountMap.get(dateString) || 0) + 1);
          if (!dateUserMap.has(dateString)) {
            dateUserMap.set(dateString, new Set<string>());
          }
          if (message.metadata.authorId) {
            dateUserMap.get(dateString)!.add(message.metadata.authorId);
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
              channelUserMap.get(channelId)!.add(message.metadata.authorId);
            }
          }
        });

        // Get channel names
        const channelNameMap = await buildChannelNameMap([...channelCountMap.keys()]);

        stats = {
          messagesByDate: Array.from(dateCountMap.entries())
            .map(([date, count]) => ({
              date,
              count,
              uniqueUsers: dateUserMap.get(date)?.size || 0
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
                name: channelNameMap.get(channelId) || 'unknown'
              },
              count,
              uniqueUsers: channelUserMap.get(channelId)?.size || 0
            }))
            .sort((a, b) => b.count - a.count)
        };

        return {
          transcript,
          messageCount: sortedMessages.length,
          uniqueUserCount: userSet.size,
          stats
        };
      } else {
        // Just return transcript without stats
        const sortedMessages = queryResults.sort((a, b) => 
          b.metadata.timestamp - a.metadata.timestamp
        );
        
        const transcript = await formatMessagesByChannel(sortedMessages, context.platformId);
        
        return {
          transcript
        };
      }
    } catch (error: any) {
      throw new Error(`No messages found in this community. Details: ${error.message}`);
    }
  },
});

// Update the formatting functions
function formatMessagesChronologically(messages: VectorStoreResult[], platformId: string, includeMessageId?: boolean): string {
  const header = `The server ID is [${platformId}]\n\n`;
  
  // Create a structured format that's easier to parse
  const formattedMessages = messages.map(message => {
    return {
      timestamp: dayjs(message.metadata.timestamp).format("YYYY-MM-DD HH:mm"),
      channelId: message.metadata.channelId || 'unknown-channel',
      messageId: message.metadata.messageId,
      username: message.metadata.authorUsername || 'Unknown User',
      content: message.metadata.text || '[No content]'
    };
  });

  // Group messages by channel
  const messagesByChannel = formattedMessages.reduce((acc, msg) => {
    if (!acc[msg.channelId]) {
      acc[msg.channelId] = [];
    }
    acc[msg.channelId].push(msg);
    return acc;
  }, {} as Record<string, typeof formattedMessages>);

  // Format each channel's messages
  const sections = Object.entries(messagesByChannel).map(([channelId, msgs]) => {
    const channelHeader = `=== Messages from Channel ID: [${channelId}] ===\n`;
    const channelMessages = msgs.map(msg => 
      `[${msg.timestamp}] [DISCORD_MESSAGE_ID=${msg.messageId}] ${msg.username}: ${msg.content}`
    ).join('\n');
    return channelHeader + channelMessages;
  });

  return header + sections.join('\n\n');
}

async function formatMessagesByChannel(messages: VectorStoreResult[], platformId: string, includeMessageId?: boolean): Promise<string> {
  return formatMessagesChronologically(messages, platformId, includeMessageId);
}
