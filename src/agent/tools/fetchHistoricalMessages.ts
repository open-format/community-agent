import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core";
import { embed } from "ai";
import dayjs from "dayjs";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { z } from "zod";

// Discord rate limit is 50 requests/sec, so we process in batches with delays
const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 200; // milliseconds

export const fetchHistoricalMessagesTool = createTool({
  id: "fetch-historical-messages",
  description: "Fetch and store Discord messages for a guild within a specified date range",
  inputSchema: z.object({
    platformId: z.string().nonempty(),
    startDate: z.number(),
    endDate: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    newMessagesAdded: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    console.log(`Starting historical message fetch for platform: ${context.platformId}`);
    console.log(`Date range: ${dayjs(context.startDate).toISOString()} to ${dayjs(context.endDate).toISOString()}`);

    // Initialize Discord client with required permissions
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    try {
      // Setup and initialization
      await client.login(process.env.DISCORD_TOKEN);
      let newMessagesAdded = 0;

      // Fetch guild and channel information
      const guild = await client.guilds.fetch(context.platformId);
      await guild.channels.fetch();
      console.log(`Processing ${guild.channels.cache.size} channels in ${guild.name}`);

      // Iterate through all channels in the guild
      for (const [, channel] of guild.channels.cache) {
        // Skip non-text channels or channels we can't access
        if (!(channel instanceof TextChannel) || !channel.viewable) continue;

        let lastMessageId;
        let messageBatch: any[] = [];

        // Fetch messages in batches until we reach messages older than start date
        while (true) {
          const options: { limit: number; before?: string } = { limit: 100 }; // 100 messages is the maximum that can be fetched at once
          if (lastMessageId) options.before = lastMessageId;

          try {
            // Fetch batch of messages
            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            // Filter for messages within date range
            const messagesInRange = messages.filter((msg) => 
              msg.createdTimestamp >= context.startDate && 
              msg.createdTimestamp <= context.endDate
            );

            // Process each message in the batch
            for (const msg of messagesInRange.values()) {
              // Skip empty content
              if (!msg.content || msg.content.trim() === "") continue;

              const exists = await vectorStore.query({
                indexName: "community_messages",
                queryVector: new Array(1536).fill(0),
                topK: 1,
                filter: {
                  messageId: msg.id,
                },
              });

              if (exists.length > 0) continue;
              // Prepare message data for vector storage
              messageBatch.push({
                content: msg.content,
                metadata: {
                  platform: "discord",
                  platformId: context.platformId,
                  messageId: msg.id,
                  authorId: msg.author.id,
                  authorUsername: msg.author.username,
                  channelId: msg.channelId,
                  threadId: msg.id,
                  timestamp: msg.createdTimestamp,
                  text: msg.content,
                  isReaction: false,
                  isBotQuery: msg.author.bot,
                },
              });

              // When batch size is reached, process and store messages
              if (messageBatch.length >= BATCH_SIZE) {
                await processMessageBatch(messageBatch, channel.name);
                newMessagesAdded += messageBatch.length;
                messageBatch = [];
                // Rate limiting delay between batches
                await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
              }
            }

            // Process any remaining messages in the final batch
            if (messageBatch.length > 0) {
              await processMessageBatch(messageBatch, channel.name);
              newMessagesAdded += messageBatch.length;
            }

            // Break if we've reached messages older than start date
            // or if we've reached messages newer than end date
            if ([...messages.values()].some((m) => 
              m.createdTimestamp < context.startDate || 
              m.createdTimestamp > context.endDate
            )) break;
            lastMessageId = messages.last()?.id;
          } catch (err) {
            console.error(`Error fetching messages from ${channel.name}:`, err);
            break;
          }
        }
      }

      // Cleanup and return results
      console.log(`Completed processing all channels. Total messages added: ${newMessagesAdded}`);
      client.destroy();

      return {
        success: true,
        newMessagesAdded,
      };
    } catch (error: unknown) {
      // Handle fatal errors and cleanup
      console.error("Fatal error:", error);
      client.destroy();
      return {
        success: false,
        newMessagesAdded: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

/**
 * Process a batch of messages by creating embeddings and storing in vector database
 * @param messages Array of messages to process
 * @param channelName Channel name for logging
 */
async function processMessageBatch(messages: any[], channelName: string) {
  try {
    // Create embeddings for all messages in parallel
    const embeddings = await Promise.all(
      messages.map((msg) =>
        embed({
          model: openai.embedding("text-embedding-3-small"),
          value: msg.content,
        }),
      ),
    );

    // Prepare data for batch storage
    const vectors = embeddings.map((e) => e.embedding);
    const metadata = messages.map((msg) => msg.metadata);

    // Store messages and embeddings in vector database
    await vectorStore.upsert({
      indexName: "community_messages",
      vectors,
      metadata,
    });
  } catch (err) {
    console.error(`Error processing batch from ${channelName}:`, err);
  }
}
