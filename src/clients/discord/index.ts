import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Message,
  MessageFlags,
  Partials,
} from "discord.js";
import { registerCommandsForGuild } from "./commands";

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

discordClient.commands = new Collection();

discordClient.on("guildCreate", async (guild) => {
  console.log(`Bot joined new server: ${guild.name} (${guild.id})`);

  if (!guild.members.me?.permissions.has("ViewChannel")) {
    console.warn(`Missing required permissions in ${guild.name}`);
  }

  const guildId = guild.id;

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

    await registerCommandsForGuild(guild.id, guild.name, discordClient);

    // Check if guild exists in platform connections
    const exists = existingConnections.some((conn) => conn.platformId === guild.id);

    if (!exists) {
      try {
        await db.insert(platformConnections).values({
          communityId: null,
          platformId: guild.id,
          platformType: "discord",
          platformName: guild.name,
        });
        console.log(`Added existing guild ${guild.name} to platform connections`);
      } catch (error) {
        console.error(`Failed to add guild ${guild.name}:`, error);
      }
    }
  }
});

discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // TODO: Implement interaction handling
  const command = discordClient.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error executing this command!",
      flags: MessageFlags.Ephemeral,
    });
  }
});

discordClient.on("voiceStateUpdate", async (oldState, newState) => {
  if (!newState.channelId || !newState.member?.user?.username) {
    return;
  }

  // TODO: Implement voice channel join handling
  // if (!oldState.channelId && newState.channelId) {
  //   await triggerAutomation({
  //     platformId: newState.guild.id,
  //     platformType: "discord",
  //     eventType: "voice_channel_join",
  //     userId: newState.member.user.username,
  //     metadata: {
  //       channelId: newState.channelId,
  //     },
  //   });
  // }
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
  console.log("<<<reaction>>>");
});

discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
