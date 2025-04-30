import { mastra } from "@/agent";
import { vectorStore } from "@/agent/stores";
import { fetchHistoricalMessagesTool } from "@/agent/tools/fetchHistoricalMessages";
import { db } from "@/db";
import { communities, platformConnections } from "@/db/schema";
import { createUnixTimestamp } from "@/utils/time";
import { openai } from "@ai-sdk/openai";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import { embed } from "ai";
import dayjs from "dayjs";
import { Client, GatewayIntentBits, type Message, MessageFlags, Partials } from "discord.js";
import { and, eq } from "drizzle-orm";
import { registerCommandsForGuild } from "./commands";
import { handleAutocomplete } from "./commands/index";
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
          startDate: createUnixTimestamp(undefined, 30),
          endDate: createUnixTimestamp(dayjs().toISOString()),
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

  if (!fetchHistoricalMessagesTool.execute) {
    throw new Error("Historical messages tool not initialized");
  }

  await registerCommandsForGuild(guild.id, guild.name, discordClient);

  await fetchHistoricalMessagesTool.execute({
    context: {
      platformId: guild.id,
      startDate: createUnixTimestamp(undefined, 30),
      endDate: createUnixTimestamp(dayjs().toISOString()),
    },
  });

  // Check if platform connection already exists
  const existingConnection = await db.query.platformConnections.findFirst({
    where: (connections, { eq }) =>
      and(eq(connections.platformId, guild.id), eq(connections.platformType, "discord")),
  });

  try {
    if (existingConnection) {
      // Update if the connection exists and name is different or null/undefined
      if (existingConnection.platformName !== guild.name || !existingConnection.platformName) {
        await db
          .update(platformConnections)
          .set({ platformName: guild.name })
          .where(eq(platformConnections.platformId, guild.id));
        console.log(`Updated guild name for ${guild.name}`);
      }

      // Create community if none exists
      if (!existingConnection.communityId) {
        const [newCommunity] = await db
          .insert(communities)
          .values({
            name: guild.name,
          })
          .returning();

        await db
          .update(platformConnections)
          .set({ communityId: newCommunity.id })
          .where(eq(platformConnections.platformId, guild.id));

        console.log(
          `Created new community for ${guild.name} and linked it to the platform connection`,
        );
      }
    } else {
      // Create new community
      const [newCommunity] = await db
        .insert(communities)
        .values({
          name: guild.name,
        })
        .returning();

      // Create new platform connection linked to the community
      await db.insert(platformConnections).values({
        communityId: newCommunity.id, // Link to community immediately
        platformId: guild.id,
        platformType: "discord",
        platformName: guild.name,
      });

      console.log(`Created new platform connection and community for ${guild.name}`);
    }
  } catch (error) {
    console.error(`Failed to setup guild ${guild.name}:`, error);
  }
});

discordClient.on("guildDelete", async (guild) => {
  console.log(`Bot left server: ${guild.name} (${guild.id})`);

  // First, get the platform connection to find the communityId
  const platformConnection = await db.query.platformConnections.findFirst({
    where: (connections, { eq }) =>
      and(eq(connections.platformId, guild.id), eq(connections.platformType, "discord")),
  });

  if (platformConnection) {
    // First delete the platform connection
    await db.delete(platformConnections).where(eq(platformConnections.platformId, guild.id));

    // Then if there's an associated community, delete it
    if (platformConnection.communityId) {
      await db.delete(communities).where(eq(communities.id, platformConnection.communityId));
    }
  }

  // find all messages in the database and delete them
  const exists = await vectorStore.query({
    indexName: "community_messages",
    queryVector: new Array(1536).fill(0),
    topK: 10000,
    filter: {
      platformId: guild.id,
    },
  });

  for (const msg of exists) {
    await vectorStore.deleteIndexById("community_messages", msg.id);
  }
});

discordClient.on("ready", async () => {
  console.log(`Logged in as ${discordClient.user?.username}`);
  console.log(`Bot is in ${discordClient.guilds.cache.size} servers:`);

  // Register commands for each guild
  for (const guild of discordClient.guilds.cache.values()) {
    console.log(`- ${guild.name} (ID: ${guild.id}) with ${guild.memberCount} members`);
    await registerCommandsForGuild(guild.id, guild.name, discordClient);
  }
});

// Add interactionCreate event handler for slash commands
discordClient.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = discordClient.commands?.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    const reply = {
      content: "There was an error while executing this command!",
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: reply.content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: reply.content, flags: MessageFlags.Ephemeral });
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
  const cleanContent = msg.content
    .replace(new RegExp(`<@!?${discordClient.user?.id}>`, "g"), "")
    .trim();

  // Skip messages from bots and ensure we're in a guild
  if (msg.author.bot || !msg.guild) return;
  const isBotQuery = msg.mentions.users.has(discordClient.user?.id ?? "");

  // Check for report generation command
  if (isBotQuery && cleanContent.toLowerCase().startsWith("!report")) {
    await handleReportCommand(msg);
    return;
  }

  // If someone mentions the bot, call the ragAgent
  if (isBotQuery) {
    // Get allowed roles
    // Show typing indicator immediately
    await msg.channel.sendTyping();
    // Then set up interval to keep it active
    const typingInterval = setInterval(() => msg.channel.sendTyping(), 9000);

    try {
      // Process the message and generate response

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

      const threadId = await getThreadStartMessageId(msg);

      const response = await mastra.getAgent("summaryAgent").generate(contextWithTimeDetails, {
        threadId: threadId,
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
    checkedForReward: false,
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
    checkedForReward: false,
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
