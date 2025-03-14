import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";

export const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL as string,
  }),
  vector: new PgVector(process.env.DATABASE_URL as string),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    // Number of recent messages to include (false to disable)
    lastMessages: 10,
    // Configure vector-based semantic search (false to disable)
    semanticRecall: {
      topK: 5, // Number of semantic search results
      messageRange: 3, // Messages before and after each result
    },
  },
});
