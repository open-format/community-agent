import { vectorStore } from "@/agent/stores";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { Step, Workflow } from "@mastra/core";
import { embed, generateText } from "ai";
import dayjs from "dayjs";
import { z } from "zod";

// Ensure script only runs in development
if (process.env.NODE_ENV !== "development") {
  console.error("This script can only be run in development mode");
  process.exit(1);
}

/**
 * Script for generating and adding test conversations to the community_messages vector store.
 * This script creates synthetic Discord-like conversations about specified topics using LLMs,
 * then embeds and stores them in the vector database for testing RAG functionality.
 * The generated messages include realistic metadata like timestamps, user IDs, and thread info
 * to simulate actual platform data.
 *
 * NOTE: This script is intended for development/testing purposes only.
 */

// Core configuration
const TOPIC = "Why blockchains are good as a value layer for Ai agents";
const MESSAGE_COUNT = 10;
const START_DATE = dayjs().subtract(1, "week").valueOf();
const END_DATE = dayjs().valueOf();
const PLATFORM_ID = "932238833146277958"; // Your Discord Server ID

// Utility functions
const generateRandomId = () => Math.floor(Math.random() * 1000000000000000000).toString();

// Define message schema
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

// Step 1: Generate raw conversation content and usernames
const generateRawMessagesStep = new Step({
  id: "generateRawMessages",
  outputSchema: z.object({
    rawMessages: z.array(z.string()),
    usernames: z.array(z.string()),
  }),
  execute: async () => {
    const systemPrompt = `
      You are a helpful assistant that generates a ${MESSAGE_COUNT}-message Discord conversation about ${TOPIC}.
      Return ONLY the message content, one message per line.
      Do NOT include any user prefixes like "User1:" or "**User2:**" in your response.
      Just provide the raw message content for each message.
    `;

    const result = await generateText({
      model: google("gemini-2.0-flash-001"),
      system: systemPrompt,
      messages: [{ role: "user", content: `Generate a conversation about ${TOPIC}` }],
    });

    // Generate usernames with another LLM call
    const usernamePrompt = `
      Generate ${Math.ceil(MESSAGE_COUNT / 2)} creative usernames for a Discord chat about ${TOPIC}.
      Usernames should be single words, lowercase, and related to the topic.
      Return ONLY the usernames, one per line, no numbers or special characters.
    `;

    const usernameResult = await generateText({
      model: google("gemini-2.0-flash-001"),
      messages: [{ role: "user", content: usernamePrompt }],
    });

    // Split the text by newlines and filter empty lines
    let messages = result.text.split("\n").filter((line: string) => line.trim());

    // Remove any user prefixes from messages (like "User1:" or "**User2:**")
    messages = messages.map((msg: string) => {
      return msg.replace(/^\*?\*?.*?\*?\*?:\s*/, "");
    });

    const usernames = usernameResult.text
      .split("\n")
      .filter((line: string) => line.trim())
      .map((name: string) => name.toLowerCase().replace(/[^a-z]/g, ""));

    return {
      rawMessages: messages,
      usernames: usernames.length > 0 ? usernames : ["dev1", "dev2"], // Development fallback usernames
    };
  },
});

// Step 2: Transform raw messages into structured format
const createStructuredMessagesStep = new Step({
  id: "createStructuredMessages",
  outputSchema: z.object({
    structuredMessages: z.array(MessageSchema),
  }),
  execute: async ({ context }: { context: any }) => {
    if (context.steps.generateRawMessages.status !== "success") {
      throw new Error("Failed to generate raw messages");
    }

    const rawMessages = context.steps.generateRawMessages.output.rawMessages;
    const usernames = context.steps.generateRawMessages.output.usernames;

    // Calculate time intervals between messages
    const timeRange = END_DATE - START_DATE;
    const timeStep = rawMessages.length > 1 ? timeRange / (rawMessages.length - 1) : 0;

    // Common IDs
    const threadId = generateRandomId();
    const channelId = generateRandomId();

    // Create user ID mapping to ensure consistent authors
    const userIdMap: Record<number, string> = {};

    // Transform raw messages into structured format
    const structuredMessages = rawMessages.map((text: string, index: number) => {
      const authorIndex = index % usernames.length;

      // Ensure consistent authorId for the same username
      if (!userIdMap[authorIndex]) {
        userIdMap[authorIndex] = generateRandomId();
      }

      const timestamp = Math.floor(START_DATE + timeStep * index);

      return {
        text,
        authorId: userIdMap[authorIndex],
        platform: "discord",
        threadId,
        channelId,
        messageId: generateRandomId(),
        timestamp,
        isBotQuery: false,
        isReaction: false,
        platformId: PLATFORM_ID,
        authorUsername: usernames[authorIndex],
      };
    });

    return {
      structuredMessages,
    };
  },
});

// Step 3: Store messages in vector database
const storeMessagesStep = new Step({
  id: "storeMessages",
  outputSchema: z.object({
    storedCount: z.number(),
    status: z.string(),
  }),
  execute: async ({ context }: { context: any }) => {
    if (context.steps.createStructuredMessages.status !== "success") {
      throw new Error("Failed to create structured messages");
    }

    const structuredMessages = context.steps.createStructuredMessages.output.structuredMessages;
    let storedCount = 0;

    try {
      for (const message of structuredMessages) {
        const embedding = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: message.text,
        });

        await vectorStore.upsert({
          indexName: "community_messages",
          vectors: [embedding.embedding],
          metadata: [message],
        });

        storedCount++;
        console.log(`Added message: ${message.messageId}`);
      }

      // Clean up resources
      if (typeof vectorStore.disconnect === "function") {
        await vectorStore.disconnect();
      }

      return {
        storedCount,
        status: "success",
      };
    } catch (error) {
      console.error("Error adding messages:", error);
      return {
        storedCount,
        status: "error",
      };
    }
  },
});

// Create and configure the workflow
const conversationWorkflow = new Workflow({
  name: "generate-conversation",
  triggerSchema: z.object({
    topic: z.string().optional(),
    messageCount: z.number().optional(),
    platformId: z.string().optional(),
  }),
});

// Add steps to the workflow
conversationWorkflow
  .step(generateRawMessagesStep)
  .then(createStructuredMessagesStep)
  .then(storeMessagesStep)
  .commit();

// Function to run the workflow
async function runConversationWorkflow() {
  try {
    // Create a run instance
    const { start } = conversationWorkflow.createRun();

    // Start the workflow with optional trigger data
    const result = await start({
      triggerData: {
        topic: TOPIC,
        messageCount: MESSAGE_COUNT,
        platformId: PLATFORM_ID,
      },
    });

    // Use type narrowing to safely access result properties
    if (result.results.storeMessages?.status === "success") {
      console.log(
        `Successfully stored ${result.results.storeMessages.output.storedCount} messages`,
      );
    } else {
      console.log("Workflow complete but store step did not succeed");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error running conversation workflow:", error);
    process.exit(1);
  }
}

// Run the workflow only in development
if (process.env.NODE_ENV === "development") {
  runConversationWorkflow()
    .then(() => console.log("Process complete"))
    .catch((err) => console.error("Process failed:", err));
} else {
  console.warn("This script should only be run in development mode");
}
