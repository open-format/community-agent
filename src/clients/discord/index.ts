import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { Client, GatewayIntentBits, type Message, Partials } from "discord.js";

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

discordClient.on("guildCreate", (guild) => {
  console.log(`Bot joined new server: ${guild.name} (${guild.id})`);

  if (!guild.members.me?.permissions.has("ViewChannel")) {
    console.warn(`Missing required permissions in ${guild.name}`);
  }
});

discordClient.on("ready", () => {
  console.log(`Logged in as ${discordClient.user?.username}`);

  // Log all servers the bot is in
  console.log(`Bot is in ${discordClient.guilds.cache.size} servers:`);
  for (const guild of discordClient.guilds.cache.values()) {
    console.log(`- ${guild.name} (ID: ${guild.id}) with ${guild.memberCount} members`);
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
    timestamp: new Date(msg.createdTimestamp),
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
  // TODO: Implement reaction handling
  console.log("<<<reaction>>>", reaction, user);
});

discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
