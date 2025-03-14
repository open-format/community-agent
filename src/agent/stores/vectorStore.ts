import { PgVector } from "@mastra/pg";

export const vectorStore = new PgVector(process.env.DATABASE_URL as string);

await vectorStore.createIndex({
  indexName: "community_documents",
  dimension: 1536,
});
