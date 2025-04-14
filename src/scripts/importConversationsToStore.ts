/**
 * Script to import Discord conversations into the community_messages vector store
 *
 * Usage:
 * 1. Place your Discord messages JSON file as 'data.json' in the same directory as this script
 * 2. Run the script:
 *    ```bash
 *    # From project root
 *    bun run src/scripts/importConversationsToStore.ts
 *    ```
 *
 * The script will:
 * - Read messages from data.json
 * - Filter out empty messages
 * - Skip messages that already exist in the store
 * - Generate embeddings and store new messages in batches
 * - Log progress and results to console
 */

import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import dayjs from "dayjs";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Discord message schema
const DiscordMessageSchema = z.object({
  type: z.number(),
  content: z.string(),
  id: z.string(),
  channel_id: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    global_name: z.string().nullable(),
  }),
  timestamp: z.string(),
  referenced_message: z
    .object({
      content: z.string(),
      id: z.string(),
      author: z.object({
        id: z.string(),
        username: z.string(),
        global_name: z.string().nullable(),
      }),
    })
    .nullable()
    .optional(),
});

// Our target message schema
const MessageSchema = z.object({
  text: z.string(),
  authorId: z.string(),
  platform: z.string(),
  threadId: z.string(),
  channelId: z.string(),
  messageId: z.string(),
  timestamp: z.number(),
  isBotQuery: z.boolean(),
  isReaction: z.boolean(),
  platformId: z.string(),
  authorUsername: z.string(),
});

type Message = z.infer<typeof MessageSchema>;
type DiscordMessage = z.infer<typeof DiscordMessageSchema>;

const BATCH_SIZE = 50; // Process 50 messages at a time
const PLATFORM_ID = "DISCORD_GUILD_ID";

/**
 * Transform Discord message to our format
 */
function transformDiscordMessage(msg: DiscordMessage): Message {
  return {
    text: msg.content,
    authorId: msg.author.id,
    platform: "discord",
    threadId: msg.referenced_message?.id || msg.id,
    channelId: msg.channel_id,
    messageId: msg.id,
    timestamp: dayjs(msg.timestamp).valueOf(),
    isBotQuery: false,
    isReaction: false,
    platformId: PLATFORM_ID,
    authorUsername: msg.author.global_name || msg.author.username,
  };
}

/**
 * Process messages in batches
 */
async function processBatch(messages: Message[]) {
  // Generate embeddings for all messages in the batch
  const embeddings = await Promise.all(
    messages.map((msg) =>
      embed({
        model: openai.embedding("text-embedding-3-small"),
        value: msg.text,
      }),
    ),
  );

  // Store all messages and embeddings in one call
  await vectorStore.upsert({
    indexName: "community_messages",
    vectors: embeddings.map((e) => e.embedding),
    metadata: messages,
  });

  return embeddings.length;
}

/**
 * Check which messages already exist in the store
 */
async function filterExistingMessages(messages: Message[]) {
  const messageIds = messages.map((m) => m.messageId);

  // Query in batches of 10 to avoid overloading
  const batchSize = 10;
  const existingIds = new Set<string>();

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const exists = await vectorStore.query({
      indexName: "community_messages",
      queryVector: new Array(1536).fill(0),
      topK: 1,
      filter: {
        messageId: { $in: batch },
      },
    });

    for (const result of exists) {
      if (result.metadata?.messageId) {
        existingIds.add(result.metadata.messageId);
      }
    }
  }

  return messages.filter((msg) => !existingIds.has(msg.messageId));
}

/**
 * Imports conversations from a JSON file into the community_messages vector store
 */
async function importConversationsFromFile(filePath: string) {
  try {
    console.log("Reading and parsing file...");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const rawMessages = JSON.parse(fileContent);

    console.log("Validating and transforming messages...");
    const discordMessages = z.array(DiscordMessageSchema).parse(rawMessages);
    const validMessages = discordMessages
      .filter((msg) => msg.content.trim().length > 0)
      .map(transformDiscordMessage);

    console.log(`Found ${validMessages.length} valid messages`);

    console.log("Filtering out existing messages...");
    const newMessages = await filterExistingMessages(validMessages);
    console.log(`Found ${newMessages.length} new messages to process`);

    let storedCount = 0;

    // Process messages in batches
    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE);
      const processed = await processBatch(batch);
      storedCount += processed;
      console.log(`Processed ${storedCount}/${newMessages.length} messages`);
    }

    console.log(`Successfully imported ${storedCount} messages`);

    return {
      storedCount,
      status: "success",
    };
  } catch (error) {
    console.error("Error importing messages:", error);
    throw error;
  }
}

// Run the import if this is the main script
const scriptDir = path.dirname(process.argv[1]);
const filePath = path.join(scriptDir, "data.json");

importConversationsFromFile(filePath)
  .then(() => {
    console.log("Import completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
