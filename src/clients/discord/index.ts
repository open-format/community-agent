import {
  Client,
  GatewayIntentBits,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  Partials,
  type User,
} from "discord.js";
import { z } from "zod";
import { memory } from "../../agent/memory/index";
import { triggerAutomation } from "../../services/automation";

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

  if (!oldState.channelId && newState.channelId) {
    await triggerAutomation({
      platformId: newState.guild.id,
      platformType: "discord",
      eventType: "voice_channel_join",
      userId: newState.member.user.username,
      metadata: {
        channelId: newState.channelId,
      },
    });
  }
});

async function getThreadStartMessageId(msg: Message): Promise<string | null> {
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

interface PlatformMessage {
  threadId: string; // Unique identifier for the conversation thread
  resourceId: string; // Platform-specific user identifier
  title: string; // First message or subject of the thread
  content: string; // Message content
  metadata: {
    platform: string; // e.g., "discord", "telegram", "slack"
    platformId: string; // Platform-specific ID (e.g., guild ID, chat ID)
    channelId: string; // Platform-specific channel/room ID
    messageId: string; // Platform-specific message ID
    authorId: string; // Platform-specific author ID
    authorUsername: string; // Platform-agnostic username
    parentMessageId?: string; // For replies/threaded conversations
    timestamp: Date; // Message timestamp
  };
}

discordClient.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const schema = z.object({
    score: z.number(),
    reason: z.string(),
  });

  console.log(msg.content);

  if (msg.reference?.messageId) {
    try {
      // Check if the referenced thread exists
      const threadStartId = await getThreadStartMessageId(msg);
      const thread = await memory.getThreadById({
        threadId: threadStartId || msg.reference.messageId,
      });

      // If thread doesn't exist, create new thread with current message
      if (!thread) {

        await memory.createThread({
          threadId: msg.id,
          resourceId: `discord:${msg.author.id}`,
          title: msg.content,
          metadata: {
            platform: "discord",
            platformId: msg.guild?.id,
            channelId: msg.channel.id,
            messageId: msg.id,
            authorId: msg.author.id,
            authorUsername: msg.author.username,
          },
        });

        // Save message to the new thread
        await memory.saveMessages({
          messages: [
            {
              id: msg.id,
              threadId: msg.id, // Use current message ID as thread
              content: msg.content,
              role: "user",
              createdAt: msg.createdAt,
              type: "text",
            },
          ],
        });
        return;
      }

      // If thread exists, save to existing thread
      await memory.saveMessages({
        messages: [
          {
            id: msg.id,
            threadId: threadStartId || msg.reference.messageId,
            content: msg.content,
            role: "user",
            createdAt: msg.createdAt,
            type: "text",
          },
        ],
      });
      return;
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  // New thread for non-reply messages
  await memory.createThread({
    threadId: msg.id,
    resourceId: `discord:${msg.author.id}`,
    title: msg.content,
    metadata: {
      platform: "discord",
      platformId: msg.guild?.id,
      channelId: msg.channel.id,
      messageId: msg.id,
      authorId: msg.author.id,
      authorUsername: msg.author.username,
    },
  });
});
discordClient.on(
  "messageReactionAdd",
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    if (message.author?.bot) return;
    console.log("<<<reaction>>>");
    try {
      // Check if thread exists first
      const thread = await memory.getThreadById({ threadId: message.id });

      // If thread doesn't exist, create it
      if (!thread) {
        await memory.createThread({
          threadId: message.id,
          resourceId: `discord:${user.id}`,
          title: message.content,
          metadata: {
            platform: "discord",
            platformId: message.guild?.id,
            channelId: message.channel.id,
            messageId: message.id,
            authorId: message.author.id,
            authorUsername: message.author.username,
          },
        });
      }

      // Save the reaction as a message
      await memory.saveMessages({
        messages: [
          {
            id: `${message.id}-${user.id}-${reaction.emoji.name}-${Date.now()}`,
            threadId: message.id,
            content: reaction.emoji.name,
            role: "user",
            createdAt: message.createdAt,
            type: "text",
          },
        ],
      });
    } catch (error) {
      console.error("Error handling reaction:", error);
    }
  },
);

discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
