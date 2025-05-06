import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { eq } from "drizzle-orm";

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error("Privy app ID or secret is not set");
}

// Create a complete command object, not just the builder
export const recommendationsCommand = {
  data: new SlashCommandBuilder()
    .setName("recommendations")
    .setDescription("get reward recommendations for a server")
    .setDefaultMemberPermissions(0),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Get the platform connection from the database
    const platformConnection = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, interaction.guildId),
      with: {
        community: true,
      },
    });

    if (!platformConnection) {
      return interaction.reply({
        content: "Can't find community",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!platformConnection.communityId) {
      return interaction.reply({
        content: "Community ID not found",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: `View your recommendations [here](${process.env.PLATFORM_URL}/recommendations?community_id=${platformConnection.communityId})`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
