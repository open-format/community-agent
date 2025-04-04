import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { getVerificationData, markCodeAsUsed, storeGuildVerification } from "@/lib/redis";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { eq } from "drizzle-orm";

// Create a complete command object, not just the builder
export const verifyCommand = {
  data: new SlashCommandBuilder()
    .setName("link-community")
    .setDescription("Link your server to a community")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The verification code from the platform")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const code = interaction.options.getString("code", true);
    const guildId = interaction.guildId;

    // Check if user has admin permissions
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({
        content: "You must be a server administrator to verify this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Verify the code
    const data = await getVerificationData(code);

    if (!data) {
      return interaction.reply({
        content: "Invalid or expired verification code.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (data.used) {
      return interaction.reply({
        content: "This verification code has already been used.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Mark code as used
    await markCodeAsUsed(code, data);

    // Store guild verification with community ID
    await storeGuildVerification(guildId, data.communityId);

    // Check if platform connection already exists
    const existingConnection = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platformId, guildId))
      .limit(1);

    // Create or update the platform connection with the community ID
    if (existingConnection.length > 0) {
      await db
        .update(platformConnections)
        .set({
          communityId: data.communityId,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.platformId, guildId));
    } else {
      await db.insert(platformConnections).values({
        platformId: guildId,
        platformType: "discord",
        communityId: data.communityId,
      });
    }

    return interaction.reply({
      content: "✅ Server verified successfully! Your server is now linked to the community.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
