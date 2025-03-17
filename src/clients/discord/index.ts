import { Client, GatewayIntentBits } from "discord.js";
import { triggerAutomation } from "../../services/automation";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.on("guildCreate", (guild) => {
  console.log(`Bot joined new server: ${guild.name} (${guild.id})`);

  if (!guild.members.me?.permissions.has("ViewChannel")) {
    console.warn(`Missing required permissions in ${guild.name}`);
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

discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
