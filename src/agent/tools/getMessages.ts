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
}

// Define the context type
interface ToolContext {
  context: {
    startDate: string;
    endDate: string;
    platformId: string;
  };
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
    platformId: z.string().nonempty()
  }),
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
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
      
      // The error shows that PostgreSQL is trying to cast timestamp as numeric
      // Let's use a simpler approach and filter by platformId only in the database
      const queryResults = await vectorStore.query({
        indexName: "community_messages",
        queryVector: dummyEmbedding.embedding,
        topK: 1000,
        includeMetadata: true,
        filter: {
          // Only filter by platformId in the database query
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
      
      // Filter by date range and reactions in JavaScript
      const filteredMessages = messages.filter(msg => {
        try {
          // Skip if it's marked as a reaction
          if (msg.isReaction === true) {
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
      
      // Filter out emoji reactions (these may not be marked with isReaction)
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
      
      return { 
        transcript: transcript || "No valid messages found after filtering.",
        messageCount: validMessages.length,
        uniqueUserCount: userSet.size,
      };
    } catch (error: any) {
      console.error('[FETCH MESSAGES] Error querying vector store:', error);
      
      // If all else fails, use the most basic approach - get all messages without filters
      try {
        console.log('[FETCH MESSAGES] Basic filter failed, attempting unfiltered query');
        
        const dummyEmbedding = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: "community messages",
        });
        
        const queryResults = await vectorStore.query({
          indexName: "community_messages",
          queryVector: dummyEmbedding.embedding,
          topK: 1000,
          includeMetadata: true,
        }) as VectorStoreResults | any[];
        
        // Extract and filter in JavaScript
        let allMessages: MessageMetadata[] = [];
        
        if (Array.isArray(queryResults)) {
          allMessages = queryResults
            .filter(result => result && result.metadata)
            .map(result => result.metadata as MessageMetadata);
        } else if (queryResults && typeof queryResults === 'object' && 'matches' in queryResults && Array.isArray(queryResults.matches)) {
          allMessages = (queryResults as VectorStoreResults).matches!
            .filter(match => match && match.metadata)
            .map(match => match.metadata as MessageMetadata);
        }
        
        // Complete filtering in JavaScript
        const filteredMessages = allMessages.filter(msg => {
          try {
            // Filter by platformId
            if (String(msg.platformId) !== context.platformId) {
              return false;
            }
            
            // Skip if it's marked as a reaction
            if (msg.isReaction === true) {
              return false;
            }
            
            // Filter by date range
            const msgDate = new Date(msg.timestamp);
            return msgDate >= startDate && msgDate <= endDate;
          } catch (e) {
            return false;
          }
        });
        
        if (filteredMessages.length === 0) {
          return { 
            transcript: `No messages found for platformId "${context.platformId}" in the date range ${startDate.toISOString()} to ${endDate.toISOString()}.`,
            messageCount: 0,
            uniqueUserCount: 0
          };
        }
        
        const userSet = new Set<string>();
        const validMessages = filteredMessages.filter(message => {
          const content = message.text || '';
          if (content.length <= 4 && /[\p{Emoji}]/u.test(content)) {
            return false;
          }
          
          if (message.authorId) {
            userSet.add(message.authorId);
          }
          
          return true;
        });
        
        validMessages.sort((a, b) => {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return dateA.getTime() - dateB.getTime();
        });
        
        const transcript = validMessages.map(message => {
          const datetime = typeof message.timestamp === 'string' 
            ? new Date(message.timestamp).toISOString()
            : message.timestamp.toISOString();
          const username = message.authorUsername || 'Unknown User';
          const content = message.text || '[No content]';
          
          return `[${datetime.slice(0, 16).replace('T', ' ')}] ${username}: ${content}`;
        }).join('\n');
        
        return { 
          transcript: transcript || "No valid messages found after filtering.",
          messageCount: validMessages.length,
          uniqueUserCount: userSet.size,
        };
      } catch (fallbackError: any) {
        console.error('[FETCH MESSAGES] Fallback query also failed:', fallbackError);
        throw new Error(`Failed to fetch messages with both approaches: ${error.message}`);
      }
    }
  },
}); 