import { type AutocompleteInteraction, type Client, Collection, REST, Routes } from "discord.js";
import { recommendationsCommand } from "./recommendations";
import { sendCommand } from "./send";

// Create proper command objects with both data and execute properties
const commands = [sendCommand, recommendationsCommand];

// Add new function to register commands for a single guild
export async function registerCommandsForGuild(
  guildId: string,
  guildName: string,
  discordClient: Client,
) {
  // Initialize the commands collection if it doesn't exist
  if (!discordClient.commands) {
    discordClient.commands = new Collection();
  }

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

// Add this to handle autocomplete
export async function handleAutocomplete(interaction: AutocompleteInteraction) {
  if (interaction.commandName === "send" && interaction.options.getFocused(true).name === "token") {
    await sendCommand.autocomplete(interaction);
  }
}
