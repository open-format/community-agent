import { GatewayIntentBits } from "discord.js";

import { Client } from "discord.js";

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

discordClient.login(process.env.DISCORD_TOKEN);

export default discordClient;
