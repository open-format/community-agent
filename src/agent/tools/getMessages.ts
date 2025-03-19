import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

// Define types for our database records
interface ThreadRecord {
  id: string;
  resourceId: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata: {
    platform: string;
    platformId?: string;
    channelId?: string;
    messageId?: string;
    authorId?: string;
    authorUsername?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface MessageRecord {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: Date | string;
  [key: string]: any;
}



export const fetchCommunityMessagesTool = createTool({
  id: 'fetch-community-messages',
  description: 'Fetch messages from PostgreSQL database for a specific platform ID and date range',
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
  execute: async ({ context }) => {
    const startDate = new Date(context.startDate);
    const endDate = new Date(context.endDate);

    try {
      // First, check if the mastra_threads table exists and inspect its schema
      try {
        await db.execute(sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'mastra_threads'
        `);
      } catch (e) {
        // Continue even if schema inspection fails
      }

      // Query for threads matching platformId
      let threads: ThreadRecord[] = [];
      try {
        // First try with JSON operators
        const threadsResult = await db.execute(sql`
          SELECT * FROM mastra_threads
          WHERE metadata::jsonb->>'platformId' = ${context.platformId}
          AND "createdAt" BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        `);
        threads = (threadsResult.rows || []) as ThreadRecord[];
      } catch (e) {
        // Fallback: Get all threads and filter in code
        const allThreadsResult = await db.execute(sql`
          SELECT * FROM mastra_threads
          WHERE "createdAt" BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        `);
        
        const allThreads = (allThreadsResult.rows || []) as any[];
        
        // Filter threads with matching platformId in JavaScript
        threads = allThreads.filter(thread => {
          try {
            // Handle different possible metadata formats
            const metadata = typeof thread.metadata === 'string' 
              ? JSON.parse(thread.metadata)
              : thread.metadata;
              
            return metadata && metadata.platformId === context.platformId;
          } catch (e) {
            return false;
          }
        }) as ThreadRecord[];
      }

      
      if (threads.length === 0) {
        return { 
          transcript: "No matching threads found for the specified platformId.",
          messageCount: 0,
          uniqueUserCount: 0
        };
      }

      // Safely prepare thread IDs for the IN clause
      const threadIds = threads.map(thread => thread.id);
      const threadIdsSql = sql.join(
        threadIds.map(id => sql`${id}`), 
        sql`, `
      );
      
      // Query messages from matching threads
      const messagesResult = await db.execute(sql`
        SELECT * FROM mastra_messages
        WHERE thread_id IN (${threadIdsSql})
        AND "createdAt" BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        ORDER BY "createdAt" ASC
      `);
      
      // Type assertion for messages
      const messages = (messagesResult.rows || []) as MessageRecord[];
      
      if (messages.length === 0 && threads.length === 0) {
        return { 
          transcript: "No messages found within matching threads and date range.",
          messageCount: 0,
          uniqueUserCount: 0
        };
      }

      // Create lookup map for threads with properly parsed metadata
      const threadMap: Record<string, {
        id: string;
        title?: string;
        metadata: {
          authorId?: string;
          authorUsername?: string;
          channelId?: string;
          platformId?: string;
          platform?: string;
          [key: string]: any;
        };
        [key: string]: any;
      }> = {};

      threads.forEach(thread => {
        let metadata = thread.metadata;
        
        // Parse metadata if it's a string
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = { platform: 'unknown' };
          }
        }
        
        // Store thread with parsed metadata
        threadMap[thread.id] = {
          ...thread,
          metadata: metadata || { platform: 'unknown' }
        };
      });

      // Track unique users from thread metadata
      const userSet = new Set<string>();
      const usernames = new Map<string, string>();
      
      // First, extract user info from threads
      for (const thread of threads) {
        let metadata = thread.metadata;
        
        // Parse metadata if it's a string
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = { platform: 'unknown' };
          }
        }
        
        if (metadata && metadata.authorId) {
          userSet.add(metadata.authorId);
          if (metadata.authorUsername) {
            usernames.set(metadata.authorId, metadata.authorUsername);
          }
        }
      }
      
      // Format messages into transcript
      
      // First, create a set of thread IDs that already have messages
      const threadsWithMessages = new Set<string>();
      messages.forEach(message => {
        threadsWithMessages.add(message.thread_id);
      });
      
      // Filter out emoji reactions from messages
      const validMessages = messages.filter(message => {
        const content = message.content || '';
        return !(content.length <= 4 && /[\p{Emoji}]/u.test(content));
      });
      
      // Format regular messages
      const messageTranscript = validMessages.map(message => {
        // Get thread with parsed metadata
        const thread = threadMap[message.thread_id] || { metadata: {} };
        const threadMetadata = thread.metadata || {};
        
        // Extract username from thread metadata
        let username = threadMetadata.authorUsername || 'Unknown User';
        
        // Format date and content
        const datetime = new Date(message.createdAt).toISOString();
        const content = message.content || '[No content]';
        
        // Simple, consistent format for all messages
        return `[${datetime.slice(0, 16).replace('T', ' ')}] ${username}: ${content}`;
      });
      
      // Get threads that don't have any messages and include their titles
      const threadsWithoutMessages = threads.filter(thread => !threadsWithMessages.has(thread.id));
      
      const threadTitleTranscript = threadsWithoutMessages.map(thread => {
        // Get metadata
        let metadata = thread.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = { platform: 'unknown' };
          }
        }
        
        // Extract username
        const username = metadata.authorUsername || 'Unknown User';
        
        // Format date
        const datetime = new Date(thread.createdAt).toISOString();
        
        // Use thread title as content
        const content = thread.title || '[No content]';
        
        // Check if it's an emoji reaction
        if (content.length <= 4 && /[\p{Emoji}]/u.test(content)) {
          return null; // Skip emoji threads
        }
        
        return `[${datetime.slice(0, 16).replace('T', ' ')}] ${username}: ${content}`;
      }).filter(entry => entry !== null); // Remove nulls
      
      // Combine both transcripts
      const transcript = [...messageTranscript, ...threadTitleTranscript].join('\n');

      // Count unique users
      const messageCount = validMessages.length + threadTitleTranscript.length;
      
      return { 
        transcript,
        messageCount,
        uniqueUserCount: userSet.size,
      };
    } catch (error: any) {
      console.error('Error querying PostgreSQL:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  },
}); 