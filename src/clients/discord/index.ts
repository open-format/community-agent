import { mastra } from "@/agent";
import { vectorStore } from "@/agent/stores";
import { openai } from "@ai-sdk/openai";
import { PGVECTOR_PROMPT } from "@mastra/rag";
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

  // If someone mentions the bot, call the ragAgent
  if (msg.mentions.has(discordClient.user?.id ?? "")) {
    const typingInterval = setInterval(() => msg.channel.sendTyping(), 9000);

    try {
      // Process the message and generate response
      const cleanContent = msg.content
        .replace(new RegExp(`<@!?${discordClient.user?.id}>`, "g"), "")
        .trim();

      const platformId = msg.guild.id;
      const guildName = msg.guild.name;

      // Create agent override with specific context
      const contextualInstructions = `
You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.

When filtering data using the vectorQueryTool, follow these guidelines:

1. The metadata structure contains these fields:
{
  platform: "discord",
  platformId: string,
  messageId: string,
  authorId: string,
  authorUsername: string,
  channelId: string,
  threadId: string,
  text: string,
  isReaction: boolean,
  isBotQuery: boolean
}

2. ALWAYS include these REQUIRED filters:
   - platformId must match "${platformId}"
   - isBotQuery must be false

3. For date/time filtering:
   - Use timestamp for date ranges (it's a Unix timestamp in milliseconds)
   - For queries like "between 9th and 11th march", convert dates to Unix timestamps and use comparison operators

${PGVECTOR_PROMPT}

IMPORTANT: When using the vectorQueryTool:
- Pass filters as a JSON object, NOT as a string
- Format should be: filter: { key: value }

EXAMPLE CORRECT USAGE:
vectorQueryTool({
  queryText: " ",
  topK: 5,
  filter: {
    platformId: "${platformId}",
    isBotQuery: false
    // Add timestamp filters when date ranges are mentioned
  }
})

Additional Instructions:
1. ONLY use information from the current Discord server (matching platformId: "${platformId}").
2. NEVER return information from other platforms or servers.
3. When asked to answer a question, please base your answer only on the context provided in the tool.
4. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
5. If you're asked about another platform or server, respond with: "I can only provide information for the ${guildName} community."
`;

      const response = await mastra.getAgent("ragAgent").generate(
        [
          {
            role: "system",
            content: contextualInstructions,
          },
          { role: "user", content: cleanContent },
        ],
        {
          threadId: await getThreadStartMessageId(msg),
          resourceId: msg.author.id,
        },
      );

      console.log(JSON.stringify(response, null, 2));

      // Send the response to the channel
      await msg.reply(response.text);
    } finally {
      // Always clear the typing interval
      clearInterval(typingInterval);
    }
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
    isReaction: false,
    isBotQuery: msg.mentions.has(discordClient.user?.id ?? ""),
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
