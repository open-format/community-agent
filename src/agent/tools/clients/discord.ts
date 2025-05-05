import { Client, GatewayIntentBits } from "discord.js";

export async function buildChannelNameMap(channelIds: string[]): Promise<Map<string, string>> {
    const channelMap = new Map<string, string>();
  
    try {
      const client = new Client({ intents: [GatewayIntentBits.Guilds] });
      await client.login(process.env.DISCORD_TOKEN);
      await new Promise((resolve) => client.once("ready", resolve));
  
      try {
        // Filter out "unknown-channel" before making API calls
        const validChannelIds = channelIds.filter((id) => id !== "unknown-channel");
  
        await Promise.all(
          validChannelIds.map(async (channelId) => {
            try {
              const channel = await client.channels.fetch(channelId);
              if (channel && "name" in channel && channel.name) {
                channelMap.set(channelId, channel.name);
              } else {
                channelMap.set(channelId, "unknown");
              }
            } catch (error) {
              console.error(`Failed to fetch channel name for ${channelId}:`, error);
              channelMap.set(channelId, "unknown");
            }
          }),
        );
  
        // Set unknown-channel explicitly
        channelMap.set("unknown-channel", "Unknown Channel");
      } finally {
        client.destroy();
      }
    } catch (error) {
      console.error("Failed to initialize Discord client:", error);
    }
  
    return channelMap;
  }
  