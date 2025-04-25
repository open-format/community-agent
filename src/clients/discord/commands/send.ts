import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { findUserByHandle, privyClient } from "@/lib/privy";
import { getToken } from "@/lib/subgraph";
import { publicClientByChainName } from "@/lib/viem";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
} from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error("Privy app ID or secret is not set");
}

// Add your subgraph client import here
// import { graphQLClient } from "@/clients/subgraph";

// Create a complete command object, not just the builder
export const sendCommand = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("send a message to the community")
    .setDefaultMemberPermissions(0)
    .addStringOption((option) =>
      option
        .setName("token")
        .setDescription("The token to send")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addNumberOption((option) =>
      option.setName("amount").setDescription("The amount to send").setRequired(true),
    )
    .addUserOption((option) =>
      option
        .setName("receiver")
        .setDescription("The Discord user to receive the tokens")
        .setRequired(true),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.respond([]);
    }

    try {
      // Get the platform connection and community info
      const platformConnection = await db.query.platformConnections.findFirst({
        where: (pc) => and(eq(pc.platformId, guildId), eq(pc.platformType, "discord")),
        with: {
          permissions: true,
        },
      });

      // check if user has permission (roleID) to send tokens
      const userPermissions = platformConnection?.permissions.filter((permission) => {
        if (!interaction.member?.roles || typeof interaction.member.roles === "string")
          return false;
        return (interaction.member.roles as GuildMemberRoleManager).cache.has(permission.roleId);
      });

      console.log({ userPermissions });

      if (!userPermissions?.length) {
        return interaction.respond([]);
      }

      const tokens: { id: string; name: string }[] = [];

      for (const permission of userPermissions) {
        const token = await getToken(permission.tokenAddress as Address, "arbitrum-sepolia");
        tokens.push(...token);
      }

      // Format tokens for Discord's autocomplete
      const choices = tokens
        .map((token) => ({
          name: `${token.name}`,
          value: token.id, // This will be the token address
        }))
        .slice(0, 25); // Discord has a 25 choice limit

      return interaction.respond(choices);
    } catch (error) {
      console.error("Error fetching tokens for autocomplete:", error);
      return interaction.respond([]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Get token, amount, and receiver from the command
    const token = interaction.options.getString("token", true);
    const amount = interaction.options.getNumber("amount", true);
    const receiver = interaction.options.getUser("receiver", true);

    // Get users wallet by Discord ID
    let user = await findUserByHandle(receiver.id);

    if (!user?.wallet) {
      const privyUser = await privyClient.importUser({
        linkedAccounts: [
          // @ts-expect-error
          {
            type: "discord_oauth",
            subject: receiver.id,
            username: receiver.username,
          },
        ],
        createEthereumWallet: true,
        createEthereumSmartWallet: true,
      });

      if (!privyUser?.wallet?.address) {
        return interaction.reply({
          content: "Failed to create wallet for user",
          flags: MessageFlags.Ephemeral,
        });
      }

      user = {
        wallet: privyUser.wallet.address,
      };
    }

    // Get the platform connection from the database
    const platformConnection = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, interaction.guildId),
      with: {
        community: true,
      },
    });

    if (
      !platformConnection?.community?.communityContractChain ||
      !platformConnection?.community?.communityContractAddress
    ) {
      return interaction.reply({
        content: "Can't find community",
        flags: MessageFlags.Ephemeral,
      });
    }

    const client = publicClientByChainName(platformConnection.community.communityContractChain);

    const wallet = createViemAccount({
      walletId: user.wallet as Address,
      address: user.wallet as Address,
      privy,
    });

    return interaction.reply({
      content: `✅ Message sent to the community`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
