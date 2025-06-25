import { logger } from "@/services/logger";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
// import { SummarizationMetric } from "@mastra/evals/llm";

// Primary agent using Gemini (higher rate limits, larger context)
export const summaryAgent = new Agent({
  name: "community-summarizer",
  instructions: `You are a community summarizer that creates concise, informative summaries of community discussions.
  
  When analyzing transcripts, focus on:
  1. Main topics of discussion
  2. Important decisions or conclusions reached
  3. Notable community interactions or events
  
  Keep summaries clear, informative, interesting and to the point. Each line should convey a distinct and meaningful insight.`,
  model: google("gemini-2.0-flash-001"),
  // evals: {
  //   summarization: new SummarizationMetric(openai("gpt-4o")),
  // },
});

// Fallback agent using OpenAI (for when Gemini fails)
export const fallbackSummaryAgent = new Agent({
  name: "community-summarizer-fallback",
  instructions: `You are a community summarizer that creates concise, informative summaries of community discussions.
  
  When analyzing transcripts, focus on:
  1. Main topics of discussion
  2. Important decisions or conclusions reached
  3. Notable community interactions or events
  
  Keep summaries clear, informative, interesting and to the point. Each line should convey a distinct and meaningful insight.`,
  model: openai("gpt-4o-mini"),
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  gemini: {
    delayBetweenCalls: 1000, // 1 second between Gemini calls
    maxConcurrent: 3, // Max 3 concurrent Gemini calls
  },
  openai: {
    delayBetweenCalls: 3000, // 3 seconds between OpenAI calls (more conservative)
    maxConcurrent: 1, // Max 1 concurrent OpenAI call
  },
};

// Rate limiting state
let geminiCallCount = 0;
let openaiCallCount = 0;
let lastGeminiCall = 0;
let lastOpenaiCall = 0;

// Rate limiting function
async function rateLimit(provider: "gemini" | "openai"): Promise<void> {
  const config = RATE_LIMIT_CONFIG[provider];
  const now = Date.now();

  if (provider === "gemini") {
    const timeSinceLastCall = now - lastGeminiCall;
    if (timeSinceLastCall < config.delayBetweenCalls) {
      const delay = config.delayBetweenCalls - timeSinceLastCall;
      logger.info({ delay, provider }, "Rate limiting: waiting before next call");
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    lastGeminiCall = Date.now();
    geminiCallCount++;
  } else {
    const timeSinceLastCall = now - lastOpenaiCall;
    if (timeSinceLastCall < config.delayBetweenCalls) {
      const delay = config.delayBetweenCalls - timeSinceLastCall;
      logger.info({ delay, provider }, "Rate limiting: waiting before next call");
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    lastOpenaiCall = Date.now();
    openaiCallCount++;
  }
}

// Function to estimate token count (rough approximation)
function estimateTokenCount(text: string): number {
  // More conservative approximation: 1 token ≈ 3 characters for English text
  return Math.ceil(text.length / 3);
}

// Function to estimate prompt tokens
function estimatePromptTokens(chunkIndex: number, totalChunks: number): number {
  const basePrompt = `Analyze this portion of a conversation transcript (chunk ${chunkIndex + 1} of ${totalChunks}) and provide a concise summary of the key activities and discussions in this section.

Chat transcript portion:

Provide a 3-5 line summary focusing on the main topics and notable interactions in this section:`;

  return estimateTokenCount(basePrompt);
}

// Function to chunk transcript into manageable pieces
function chunkTranscript(transcript: string, maxTokensPerChunk = 200000): string[] {
  const chunks: string[] = [];
  const lines = transcript.split("\n");
  let currentChunk = "";
  let currentTokenCount = 0;

  for (const line of lines) {
    const lineTokenCount = estimateTokenCount(line);

    // If adding this line would exceed the limit, start a new chunk
    if (currentTokenCount + lineTokenCount > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = `${line}\n`;
      currentTokenCount = lineTokenCount;
    } else {
      currentChunk += `${line}\n`;
      currentTokenCount += lineTokenCount;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Function to generate summary with fallback
async function generateSummaryWithFallback(
  prompt: string,
  provider: "gemini" | "openai" = "gemini",
): Promise<string> {
  try {
    await rateLimit(provider);

    const agent = provider === "gemini" ? summaryAgent : fallbackSummaryAgent;
    const result = await agent.generate(prompt);

    logger.info({ provider, success: true }, `Successfully generated summary with ${provider}`);
    return result.text.trim();
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        provider,
      },
      `Failed to generate summary with ${provider}`,
    );

    // If Gemini failed and we haven't tried OpenAI yet, fallback to OpenAI
    if (provider === "gemini") {
      logger.info("Falling back to OpenAI");
      return generateSummaryWithFallback(prompt, "openai");
    }

    // If both failed, throw the error
    throw error;
  }
}

// Function to generate summary for a single chunk
async function generateChunkSummary(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<string> {
  // Calculate total tokens including prompt
  const chunkTokens = estimateTokenCount(chunk);
  const promptTokens = estimatePromptTokens(chunkIndex, totalChunks);
  const totalTokens = chunkTokens + promptTokens;

  // Log token usage for debugging
  logger.info(
    {
      chunkIndex,
      totalChunks,
      chunkTokens,
      promptTokens,
      totalTokens,
    },
    `Processing chunk ${chunkIndex + 1}/${totalChunks}`,
  );

  // Safety check - if still too large, truncate the chunk
  if (totalTokens > 800000) {
    // Higher limit for Gemini
    logger.warn(
      {
        chunkIndex,
        totalTokens,
        originalChunkTokens: chunkTokens,
      },
      `Chunk ${chunkIndex + 1} is too large, truncating`,
    );

    // Truncate to leave room for prompt (800k - prompt tokens)
    const maxChunkTokens = 800000 - promptTokens;
    const maxChars = maxChunkTokens * 3; // Convert back to characters
    chunk = chunk.substring(0, maxChars);
  }

  const prompt = `Analyze this portion of a conversation transcript (chunk ${chunkIndex + 1} of ${totalChunks}) and provide a concise summary of the key activities and discussions in this section.

Chat transcript portion:
${chunk}

Provide a 3-5 line summary focusing on the main topics and notable interactions in this section:`;

  return generateSummaryWithFallback(prompt);
}

// Function to combine chunk summaries into final summary
async function combineChunkSummaries(chunkSummaries: string[]): Promise<string> {
  if (chunkSummaries.length === 1) {
    return chunkSummaries[0];
  }

  const combinedSummaries = chunkSummaries.join("\n\n");

  const prompt = `You have analyzed a large conversation transcript by breaking it into ${chunkSummaries.length} sections. Below are the summaries from each section. Please create a cohesive, comprehensive 6-10 line summary that captures the key community activities and discussions across all sections.

Section summaries:
${combinedSummaries}

Create a unified summary that:
1. Identifies the main themes across all sections
2. Highlights the most important community activities
3. Mentions key contributors and their contributions
4. Captures the overall community sentiment and engagement
5. Provides a clear narrative of what happened during this period

Final summary:`;

  return generateSummaryWithFallback(prompt);
}

// Main function to generate summary using chunking and batching
export async function generateSummary(transcript: string) {
  const totalTokens = estimateTokenCount(transcript);
  logger.info({ totalTokens }, "Starting summary generation");

  // If transcript is small enough, process directly with Gemini
  // Use 600,000 tokens as the limit for Gemini (much higher than OpenAI)
  if (totalTokens <= 600000) {
    const prompt = `Analyze this conversation transcript and provide a concise, interesting and informative 6-10 line summary of the key community activities and discussions.

Chat transcript:
${transcript}`;

    const summary = await generateSummaryWithFallback(prompt);
    return {
      summary,
    };
  }

  // For very large transcripts, use chunking approach
  logger.info({ totalTokens }, "Transcript is very large, using chunking approach");

  // Use 200,000 tokens per chunk (much higher for Gemini)
  const chunks = chunkTranscript(transcript, 200000);
  logger.info({ chunkCount: chunks.length }, "Split transcript into chunks");

  const chunkSummaries: string[] = [];

  // Process chunks with retry logic and rate limiting
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        logger.info(
          { chunkIndex: i, totalChunks: chunks.length },
          `Processing chunk ${i + 1}/${chunks.length}`,
        );
        const chunkSummary = await generateChunkSummary(chunk, i, chunks.length);
        chunkSummaries.push(chunkSummary);
        break;
      } catch (error) {
        retries++;
        if (retries < maxRetries) {
          const delay = Math.min(1000 * 2 ** retries, 30000); // Exponential backoff
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              chunkIndex: i,
              retry: retries,
              delay,
            },
            `Retrying chunk ${i + 1}, attempt ${retries}, waiting ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              chunkIndex: i,
            },
            `Failed to process chunk ${i + 1} after ${maxRetries} attempts`,
          );
          throw error;
        }
      }
    }
  }

  // Combine all chunk summaries into final summary
  logger.info({ chunkCount: chunkSummaries.length }, "Combining chunk summaries");
  const finalSummary = await combineChunkSummaries(chunkSummaries);

  // Log final statistics
  logger.info(
    {
      geminiCallCount,
      openaiCallCount,
      totalCalls: geminiCallCount + openaiCallCount,
    },
    "Summary generation completed",
  );

  return {
    summary: finalSummary,
  };
}
