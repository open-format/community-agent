import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { vectorStore } from '@/agent/stores';
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

// Define MessageMetadata interface
interface MessageMetadata {
  platform: string;
  platformId: string;
  messageId: string;
  authorId: string;
  authorUsername: string;
  channelId: string;
  threadId: string;
  timestamp: Date | string;
  text: string;
  isReaction: boolean;
  isSummary?: boolean;
}

// Define the context type
interface ToolContext {
  context: {
    startDate: string;
    endDate: string;
    platformId: string;
    includeStats?: boolean;
  };
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
  channelId: string;
  count: number;
  uniqueUsers: number;
}

interface MessageStats {
  messagesByDate: DateStat[];
  topContributors: ContributorStat[];
  messagesByChannel: ChannelStat[];
}

// Define the result type for vector store
interface VectorStoreResults {
  matches?: Array<{
    metadata?: any;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export const fetchCommunityMessagesTool = createTool({
  id: 'fetch-community-messages',
  description: 'Fetch messages from vector store for a specific platform ID and date range',
  inputSchema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    platformId: z.string().nonempty(),
    includeStats: z.boolean().optional()
  }),
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
        channelId: z.string(),
        count: z.number(),
        uniqueUsers: z.number()
      }))
    }).optional()
  }),
  execute: async ({ context }: ToolContext) => {
    const startDate = new Date(context.startDate);
    const endDate = new Date(context.endDate);

    try {
      // Create a dummy embedding for the query
      const dummyEmbedding = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: "community messages",
      });
      
      const queryResults = await vectorStore.query({
        indexName: "community_messages",
        queryVector: dummyEmbedding.embedding,
        topK: 10000,
        includeMetadata: true,
        filter: {
          platformId: context.platformId
        }
      }) as VectorStoreResults | any[];
      
      // Extract messages from query results
      let messages: MessageMetadata[] = [];
      
      if (Array.isArray(queryResults)) {
        messages = queryResults
          .filter(result => result && result.metadata)
          .map(result => result.metadata as MessageMetadata);
      } else if (queryResults && typeof queryResults === 'object' && 'matches' in queryResults && Array.isArray(queryResults.matches)) {
        messages = (queryResults as VectorStoreResults).matches!
          .filter(match => match && match.metadata)
          .map(match => match.metadata as MessageMetadata);
      }
      
      // Filter by date range and exclude summaries
      const filteredMessages = messages.filter(msg => {
        try {
          // Skip if it's a summary
          if (msg.isSummary === true) {
            return false;
          }
          
          // Filter by date range
          const msgDate = new Date(msg.timestamp);
          return msgDate >= startDate && msgDate <= endDate;
        } catch (e) {
          return false;
        }
      });
      
      // If we found no messages
      if (filteredMessages.length === 0) {
        return { 
          transcript: `No messages found for platformId "${context.platformId}" in the date range ${startDate.toISOString()} to ${endDate.toISOString()}.`,
          messageCount: 0,
          uniqueUserCount: 0
        };
      }

      // Track unique users
      const userSet = new Set<string>();
      
      // Only filter out emoji-only messages (no longer checking isReaction) COME BACK TO THIS
      const validMessages = filteredMessages.filter(message => {
        // Skip messages that are just emojis (4 or fewer characters and containing emoji)
        const content = message.text || '';
        if (content.length <= 4 && /[\p{Emoji}]/u.test(content)) {
          return false;
        }
        
        // Add user to the set for unique user count
        if (message.authorId) {
          userSet.add(message.authorId);
        }
        
        return true;
      });
      
      // Sort messages by timestamp
      validMessages.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Format messages into transcript
      const transcript = validMessages.map(message => {
        // Format date and content
        const datetime = typeof message.timestamp === 'string' 
          ? new Date(message.timestamp).toISOString()
          : message.timestamp.toISOString();
        const username = message.authorUsername || 'Unknown User';
        const content = message.text || '[No content]';
        
        // Simple, consistent format for all messages
        return `[${datetime.slice(0, 16).replace('T', ' ')}] ${username}: ${content}`;
      }).join('\n');
      
      // Generate stats if requested
      let stats: MessageStats | undefined = undefined;
      
      if (context.includeStats) {
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
        
        validMessages.forEach(message => {
          // Format date for grouping (YYYY-MM-DD)
          const messageDate = new Date(message.timestamp);
          const dateString = messageDate.toISOString().split('T')[0];
          
          // Count messages by date
          dateCountMap.set(dateString, (dateCountMap.get(dateString) || 0) + 1);
          
          // Track unique users by date
          if (message.authorId) {
            if (!dateUserMap.has(dateString)) {
              dateUserMap.set(dateString, new Set<string>());
            }
            dateUserMap.get(dateString)!.add(message.authorId);
          }
          
          // Count messages by contributor
          const username = message.authorUsername || 'Unknown User';
          contributorCountMap.set(username, (contributorCountMap.get(username) || 0) + 1);
          
          // Count messages and unique users by channel
          if (message.channelId) {
            // Count total messages
            channelCountMap.set(message.channelId, (channelCountMap.get(message.channelId) || 0) + 1);
            
            // Track unique users per channel
            if (message.authorId) {
              if (!channelUserMap.has(message.channelId)) {
                channelUserMap.set(message.channelId, new Set<string>());
              }
              channelUserMap.get(message.channelId)!.add(message.authorId);
            }
          }
        });
        
        // Convert maps to sorted arrays
        const messagesByDate: DateStat[] = Array.from(dateCountMap.entries())
          .map(([date, count]) => ({ 
            date, 
            count,
            uniqueUsers: dateUserMap.has(date) ? dateUserMap.get(date)!.size : 0
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        const topContributors: ContributorStat[] = Array.from(contributorCountMap.entries())
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5 contributors
        
        const messagesByChannel: ChannelStat[] = Array.from(channelCountMap.entries())
          .map(([channelId, count]) => ({ 
            channelId, 
            count,
            uniqueUsers: channelUserMap.has(channelId) ? channelUserMap.get(channelId)!.size : 0
          }))
          .sort((a, b) => b.count - a.count); // Sort by most active channels
        
        stats = {
          messagesByDate,
          topContributors,
          messagesByChannel
        };
      }
      
      const result: any = { 
        transcript: transcript || "No valid messages found after filtering.",
        messageCount: validMessages.length,
        uniqueUserCount: userSet.size
      };
      
      if (stats) {
        result.stats = stats;
      }
      
      return result;
    } catch (error: any) {
      throw new Error(`No messages found in this community. Details: ${error.message}`);
    }
  },
}); 