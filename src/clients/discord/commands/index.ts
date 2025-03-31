import { type Client, REST, Routes } from "discord.js";
import { verifyCommand } from "./verify";

// Create proper command objects with both data and execute properties
const commands = [verifyCommand];

// Add new function to register commands for a single guild
export async function registerCommandsForGuild(
  guildId: string,
  guildName: string,
  discordClient: Client,
) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN as string);

  try {
    // Register only the command data with Discord API
    await rest.put(Routes.applicationGuildCommands(discordClient.user?.id as string, guildId), {
      body: commands.map((cmd) => cmd.data.toJSON()),
    });

    // Register commands in the client's collection
    for (const command of commands) {
      discordClient.commands.set(command.data.name, command);
    }

    console.log(`Slash commands registered successfully for guild: ${guildName}`);
  } catch (error) {
    console.error(`Error registering slash commands for guild ${guildName}:`, error);
  }
}
