import { vectorStore } from "@/agent/stores";
import { logger } from "@/services/logger";
import { handleDiscordAPIError, isRecoverableDiscordError } from "@/utils/errors";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core";
import { embed } from "ai";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { z } from "zod";

// Discord rate limit is 50 requests/sec, so we process in batches with delays
const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY = 100; // milliseconds

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
    logger.info(
      {
        platformId: context.platformId,
        startDate: context.startDate,
        endDate: context.endDate,
      },
      "Starting historical message fetch",
    );

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
      logger.info(
        {
          guildId: guild.id,
          guildName: guild.name,
          channelCount: guild.channels.cache.size,
        },
        "Processing channels in guild",
      );

      // Iterate through all channels in the guild
      for (const [, channel] of guild.channels.cache) {
        // Skip non-text channels or channels we can't access
        if (!(channel instanceof TextChannel) || !channel.viewable) continue;

        let lastMessageId: string | undefined;
        let messageBatch: { content: string; metadata: MessageMetadata }[] = [];

        // Fetch messages in batches until we reach messages older than start date
        while (true) {
          const options: { limit: number; before?: string } = { limit: 100 }; // 100 messages is the maximum that can be fetched at once
          if (lastMessageId) options.before = lastMessageId;

          try {
            // Fetch batch of messages
            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            // Filter for messages within date range
            const messagesInRange = messages.filter(
              (msg) =>
                msg.createdTimestamp >= context.startDate &&
                msg.createdTimestamp <= context.endDate,
            );

            // Process each message in the batch
            for (const msg of messagesInRange.values()) {
              try {
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

                // Handle message references safely
                let threadId = msg.id;
                if (msg.reference?.messageId) {
                  try {
                    const referencedMsg = await msg.fetchReference();
                    // Simple thread ID determination - could be enhanced with full thread traversal
                    threadId = referencedMsg.id;
                  } catch (refError) {
                    // Handle reference fetching errors gracefully
                    const errorDetails = handleDiscordAPIError(refError, {
                      messageId: msg.reference.messageId,
                      channelId: msg.channelId,
                      guildId: context.platformId,
                      operation: "fetchReference",
                    });

                    // Continue with current message ID as thread ID if reference fetch fails
                    if (isRecoverableDiscordError(errorDetails)) {
                      threadId = msg.id;
                    } else {
                      // For non-recoverable errors, skip this message
                      continue;
                    }
                  }
                }

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
                    threadId: threadId,
                    timestamp: msg.createdTimestamp,
                    text: msg.content,
                    isReaction: false,
                    isBotQuery: msg.author.bot,
                    checkedForReward: false,
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
              } catch (msgError) {
                // Handle individual message processing errors
                const errorDetails = handleDiscordAPIError(msgError, {
                  messageId: msg.id,
                  channelId: msg.channelId,
                  guildId: context.platformId,
                  operation: "processMessage",
                });

                // Continue processing other messages even if one fails
                if (isRecoverableDiscordError(errorDetails)) {
                  continue;
                }

                logger.error(
                  {
                    error: errorDetails,
                    messageId: msg.id,
                    channelId: msg.channelId,
                  },
                  "Failed to process message, skipping",
                );

                continue;
              }
            }

            // Process any remaining messages in the final batch
            if (messageBatch.length > 0) {
              await processMessageBatch(messageBatch, channel.name);
              newMessagesAdded += messageBatch.length;
            }

            // Break if we've reached messages older than start date
            // or if we've reached messages newer than end date
            if (
              [...messages.values()].some(
                (m) =>
                  m.createdTimestamp < context.startDate || m.createdTimestamp > context.endDate,
              )
            )
              break;
            lastMessageId = messages.last()?.id;
          } catch (err) {
            // Handle Discord API errors when fetching messages from channel
            const errorDetails = handleDiscordAPIError(err, {
              channelId: channel.id,
              guildId: context.platformId,
              operation: "fetchMessages",
            });

            // If it's a recoverable error (like missing access), skip this channel and continue
            if (isRecoverableDiscordError(errorDetails)) {
              logger.warn(
                {
                  channelId: channel.id,
                  channelName: channel.name,
                  error: errorDetails,
                },
                `Skipping channel due to Discord API error: ${errorDetails.message}`,
              );
              break;
            }
            // For non-recoverable errors, still break from this channel but continue with others
            logger.error(
              {
                channelId: channel.id,
                channelName: channel.name,
                error: errorDetails,
              },
              `Fatal error fetching messages from channel: ${errorDetails.message}`,
            );
            break;
          }
        }
      }

      // Cleanup and return results
      logger.info(
        {
          platformId: context.platformId,
          newMessagesAdded,
        },
        "Completed processing all channels",
      );
      client.destroy();

      return {
        success: true,
        newMessagesAdded,
      };
    } catch (error: unknown) {
      // Handle fatal errors and cleanup
      const errorDetails = handleDiscordAPIError(error, {
        guildId: context.platformId,
        operation: "fetchHistoricalMessages",
      });

      logger.error(
        {
          platformId: context.platformId,
          error: errorDetails,
        },
        "Fatal error in historical message fetch",
      );

      client.destroy();
      return {
        success: false,
        newMessagesAdded: 0,
        error: errorDetails.message,
      };
    }
  },
});

/**
 * Process a batch of messages by creating embeddings and storing in vector database
 * @param messages Array of messages to process
 * @param channelName Channel name for logging
 */
async function processMessageBatch(
  messages: { content: string; metadata: MessageMetadata }[],
  channelName: string,
) {
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
    logger.error(
      {
        channelName,
        batchSize: messages.length,
        error: err instanceof Error ? err.message : err,
      },
      "Error processing message batch",
    );
  }
}
