import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { z } from "zod";

export const saveSummaryTool = createTool({
  id: "save-summary",
  description: "Save a community summary to the database with vector embeddings",
  inputSchema: z.object({
    communityId: z.string(),
    summary: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
    summarizationResult: z.any().optional(),
    platformId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Extract the scores from the summarization result
      const summarizationScore = context.summarizationResult?.summarizationScore || null;
      const coverageScore = context.summarizationResult?.coverageScore || null;
      const alignmentScore = context.summarizationResult?.alignmentScore || null;
      const summarizationReason = context.summarizationResult?.reason || null;

      // Generate embedding for the summary
      // Initialise the document
      const doc = MDocument.fromText(context.summary);

      // Create chunks
      const chunks = await doc.chunk({
        strategy: "recursive",
        size: 256,
        overlap: 50,
      });

      // Generate embeddings with OpenAI
      const { embeddings: openAIEmbeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: chunks.map((chunk: { text: string }) => chunk.text),
      });

      // Format embeddings for PostgreSQL vector type
      const formattedEmbeddings = openAIEmbeddings[0]; // Take first embedding since we want to store one vector per summary

      return {
        success: true,
        summaryId: result.id,
      };
    } catch (error: any) {
      console.error("Exception saving summary:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
});
