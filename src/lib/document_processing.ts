import { openai } from "@ai-sdk/openai";

import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { vectorStore } from "../agent/stores/vectorStore";

export async function processAndStoreDocument(
  communityId: string,
  filename: string,
  documentContent: string,
): Promise<void> {
  // Validate communityId before processing
  if (!communityId) {
    throw new Error("Community ID is required for document processing");
  }

  const doc = MDocument.fromMarkdown(documentContent);

  try {
    // Create chunks
    const chunks = await doc.chunk();

    // Generate embeddings with OpenAI
    const { embeddings: openAIEmbeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: chunks.map((chunk) => chunk.text),
    });

    await vectorStore.upsert({
      indexName: "community_documents",
      vectors: openAIEmbeddings,
      metadata: chunks.map((chunk) => ({ text: chunk.text, community_id: communityId })),
    });

    console.log(`Document "${filename}" processed and stored for community "${communityId}".`);
  } catch (error) {
    console.error(`Error processing and storing document "${filename}":`, error);
    throw error; // Re-throw to allow caller to handle the error
  }
}
