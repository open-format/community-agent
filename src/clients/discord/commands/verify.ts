import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { VerificationResult, verifyCommunity } from "@/lib/verification";
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
    const verificationResult = await verifyCommunity(code, guildId, "discord");

    if ( VerificationResult.FAILED === verificationResult ) {
      return interaction.reply({
        content: "Invalid or expired verification code.",
        flags: MessageFlags.Ephemeral,
      });
    }
    
    if (VerificationResult.USED === verificationResult ) {
      return interaction.reply({
        content: "This verification code has already been used.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: "✅ Server verified successfully! Your server is now linked to the community.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
