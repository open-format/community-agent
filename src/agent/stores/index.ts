import { PgVector } from "@mastra/pg";

export const vectorStore = new PgVector(process.env.DATABASE_URL as string);

await vectorStore.createIndex({
  indexName: "community_documents",
  dimension: 1536,
});

/**
 * Vector store for Discord messages.
 *
 * This vector store is used to:
 * - Index and store Discord messages as embeddings
 * - Enable semantic search across Discord message history
 * - Associate metadata with messages (author, channel, etc.)
 * - Support filtering by message attributes
 *
 * Messages are stored with their vector embeddings (1536-dimension)
 * created using OpenAI's text-embedding-3-small model. Each message
 * is associated with metadata including platform, channel, author,
 * and message IDs to enable targeted retrieval.
 *
 * @example
 * // Create index
 * await vectorStore.createIndex({
 *   indexName: "embeddings",
 *   dimension: 1536,
 * });
 *
 * // Store a message with metadata
 * await vectorStore.upsert({
 *   indexName: "embeddings",
 *   vectors: [embedding],
 *   metadata: [{
 *     platform: "discord",
 *     platformId: guildId,
 *     channelId: channelId,
 *     messageId: messageId,
 *     authorId: authorId,
 *     authorUsername: username,
 *   }],
 * });
 */
await vectorStore.createIndex({
  indexName: "community_messages",
  dimension: 1536,
});

await vectorStore.createIndex({
  indexName: "summaries",
  dimension: 1536,
});
