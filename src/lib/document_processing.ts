import { type DistanceStrategy, PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { embeddings } from "../agent/models/openai";
import { db, pool } from "../db";
import { communityDocuments } from "../db/schema";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

const config = {
  pool: pool,
  tableName: "community_documents",
  columns: {
    idColumnName: "id",
    vectorColumnName: "embedding",
    contentColumnName: "chunk_content",
    metadataColumnName: "metadata",
    community_id: "community_id",
  },
  distanceStrategy: "cosine" as DistanceStrategy,
};

export async function processAndStoreDocument(
  communityId: string,
  filename: string,
  documentContent: string
): Promise<void> {
  // Validate communityId before processing
  if (!communityId) {
    throw new Error("Community ID is required for document processing");
  }

  try {
    const textSplits = await splitter.splitText(documentContent);

    // Process each text chunk
    for (const chunk of textSplits) {
      // Generate embeddings for the chunk
      const [embedding] = await embeddings.embedDocuments([chunk]);

      // Insert document chunk into the database using Drizzle
      await db.insert(communityDocuments).values({
        communityId: communityId,
        chunkContent: chunk,
        embedding: embedding,
        metadata: { filename, community_id: communityId }, // Store filename in metadata
      });
    }

    console.log(`Document "${filename}" processed and stored for community "${communityId}".`);
  } catch (error) {
    console.error(`Error processing and storing document "${filename}":`, error);
    throw error; // Re-throw to allow caller to handle the error
  }
}

// Function to perform similarity search scoped by communityId
export async function performCommunityScopedSimilaritySearch(
  communityId: string,
  query: string,
  k = 5
): Promise<Document[]> {
  try {
    const pgvectorStore = await PGVectorStore.initialize(embeddings, config);

    // Perform similarity search with filter for community_id
    const results = await pgvectorStore.similaritySearch(query, k, {
      community_id: communityId,
    });

    return results;
  } catch (error) {
    console.error("Error performing similarity search:", error);
    return [];
  }
}
