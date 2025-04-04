import { mastra } from "@/agent";
import { vectorStore } from "@/agent/stores";
import { fetchHistoricalMessagesTool } from "@/agent/tools/fetchHistoricalMessages";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { openai } from "@ai-sdk/openai";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import { embed } from "ai";
import { Client, GatewayIntentBits, type Message, Partials } from "discord.js";
import { eq } from "drizzle-orm";
import { handleReportCommand } from "./commands/report";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

discordClient.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.id === discordClient.user?.id) {
    if (newMember.roles.cache.size > oldMember.roles.cache.size) {
      if (!fetchHistoricalMessagesTool.execute) {
        throw new Error("Historical messages tool not initialized");
      }

      await fetchHistoricalMessagesTool.execute({
        context: {
          platformId: newMember.guild.id,
        },
      });
    }
  }
});

discordClient.on("guildCreate", async (guild) => {
  console.log(`Bot joined new server: ${guild.name} (${guild.id})`);

  if (!guild.members.me?.permissions.has("ViewChannel")) {
    console.warn(`Missing required permissions in ${guild.name}`);
  }

  const guildId = guild.id;

  if (!fetchHistoricalMessagesTool.execute) {
    throw new Error("Historical messages tool not initialized");
  }

  await fetchHistoricalMessagesTool.execute({
    context: {
      platformId: guild.id,
    },
  });

  try {
    await db.insert(platformConnections).values({
      communityId: null,
      platformId: guildId,
      platformType: "discord",
    });
    console.log(`Added new guild ${guild.name} to platform connections`);
  } catch (error) {
    console.error(error);
  }
});

discordClient.on("ready", async () => {
  console.log(`Logged in as ${discordClient.user?.username}`);

  // Log all servers the bot is in
  console.log(`Bot is in ${discordClient.guilds.cache.size} servers:`);

  // Get all existing platform connections
  const existingConnections = await db.query.platformConnections.findMany({
    where: (connections, { eq }) => eq(connections.platformType, "discord"),
  });

  for (const guild of discordClient.guilds.cache.values()) {
    console.log(`- ${guild.name} (ID: ${guild.id}) with ${guild.memberCount} members`);

    const existingConnection = existingConnections.find((conn) => conn.platformId === guild.id);

    try {
      if (existingConnection) {
        // Update if the connection exists and either name is different or null/undefined
        if (existingConnection.platformName !== guild.name || !existingConnection.platformName) {
          await db
            .update(platformConnections)
            .set({ platformName: guild.name })
            .where(eq(platformConnections.platformId, guild.id));
          console.log(`Updated guild name for ${guild.name}`);
        }
      } else {
        // Insert new guild if it doesn't exist
        await db.insert(platformConnections).values({
          communityId: null,
          platformId: guild.id,
          platformType: "discord",
          platformName: guild.name,
        });
        console.log(`Added new guild ${guild.name} to platform connections`);
      }
    } catch (error) {
      console.error(`Failed to upsert guild ${guild.name}:`, error);
    }
  }
});

async function getThreadStartMessageId(msg: Message): Promise<string> {
  let currentMsg = msg;

  while (currentMsg.reference?.messageId) {
    const referencedMsg = await currentMsg.fetchReference();
    if (!referencedMsg.reference) {
      return referencedMsg.id; // This is the first message
    }
    currentMsg = referencedMsg;
  }

  return currentMsg.id;
}

discordClient.on("messageCreate", async (msg) => {
  // Skip messages from bots and ensure we're in a guild
  if (msg.author.bot || !msg.guild) return;
  const isBotQuery = msg.mentions.has(discordClient.user?.id ?? "");

  // Check for report generation command
  if (isBotQuery && msg.content.toLowerCase().includes("!report")) {
    await handleReportCommand(msg);
    return;
  }

  // If someone mentions the bot, call the ragAgent
  if (isBotQuery) {
    // Get allowed roles
    const allowedRoles = process.env.DISCORD_ALLOWED_ROLES?.split(",") ?? [];
    const hasAllowedRole = msg.member?.roles.cache.some((role) => allowedRoles.includes(role.id));

    if (!hasAllowedRole) {
      return;
    }
    // Show typing indicator immediately
    await msg.channel.sendTyping();
    // Then set up interval to keep it active
    const typingInterval = setInterval(() => msg.channel.sendTyping(), 9000);

    try {
      // Process the message and generate response
      const cleanContent = msg.content
        .replace(new RegExp(`<@!?${discordClient.user?.id}>`, "g"), "")
        .trim();

      const platformId = msg.guild.id;
      const guildName = msg.guild.name;

      const contextWithTimeDetails = `
Query: ${cleanContent}

The user is asking about conversations in a community with platform ID: ${platformId}. Always use the guild name ${guildName} when referring to the community.

Filter the context by searching the metadata.
  
  The metadata is structured as follows:
 
  {
    platformId: string,
    timestamp: number,
  }

    filtering timestamp is like this:
  $and: [
    { timestamp: { $gte: [UNIX_MILLISECONDS_TIMESTAMP_FROM_30_DAYS_AGO] } },
    { timestamp: { $lte: [UNIX_MILLISECONDS_TIMESTAMP_TODAY] } },
  ],

  if no timestamp is provided, use the past 30 days.


  Set topK to 20
 
  ${PGVECTOR_PROMPT}

Please search through the conversation history to find relevant information.
`;

      const response = await mastra.getAgent("summaryAgent").generate(contextWithTimeDetails, {
        threadId: "1234567890",
        resourceId: msg.author.id,
        memoryOptions: {
          lastMessages: 10,
        },
      });

      // Send the response to the channel
      await msg.reply(response.text);
    } catch (error) {
      console.error("Error processing message:", error);
    } finally {
      clearInterval(typingInterval);
    }
  }

  if (isBotQuery) {
    return;
  }

  // Generate embeddings for message content
  const embedding = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: msg.content,
  });

  // Initialize metadata for the message
  const metadata: MessageMetadata = {
    platform: "discord",
    platformId: msg.guild.id,
    messageId: msg.id,
    authorId: msg.author.id,
    authorUsername: msg.author.username,
    channelId: msg.channelId,
    threadId: msg.id,
    timestamp: msg.createdTimestamp,
    text: msg.content,
    isBotQuery: msg.author.bot,
    isReaction: false,
  };

  // If this is a reply to another message, get the parent message's ID
  if (msg.reference?.messageId) {
    metadata.threadId = await getThreadStartMessageId(msg);
  }

  // Store in vector store
  await vectorStore.upsert({
    indexName: "community_messages",
    vectors: [embedding.embedding],
    metadata: [metadata],
  });
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  // get message from cache for reaction
  const message = await reaction.message.fetch();

  if (message.author.bot || !message.guild) {
    return;
  }

  // Initialize metadata for the message
  const metadata: MessageMetadata = {
    platform: "discord",
    platformId: message.guild.id,
    messageId: message.id,
    authorId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channelId,
    threadId: message.id,
    timestamp: message.createdTimestamp,
    text: reaction.emoji.name ?? "",
    isBotQuery: message.author.bot,
    isReaction: true,
  };

  // Generate embeddings for message content
  const embedding = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: reaction.emoji.name ?? "",
  });

  // Store in vector store
  await vectorStore.upsert({
    indexName: "community_messages",
    vectors: [embedding.embedding],
    metadata: [metadata],
  });
});
discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
