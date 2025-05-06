import { rewardFacetAbi } from "@/abis/RewardFacet";
import { type ChainName, getChain } from "@/constants/chains";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { findUserByHandle, privyClient } from "@/lib/privy";
import { getToken } from "@/lib/subgraph";
import { getPublicClientByChainName, getWalletClientByChainName } from "@/lib/viem";
import { formatViemErrorForDiscord, handleViemError } from "@/utils/errors";
import { createViemAccount } from "@privy-io/server-auth/viem";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
  TextChannel,
} from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { and, eq } from "drizzle-orm";
import { type Address, parseEther, stringToHex } from "viem";

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error("Privy app ID or secret is not set");
}

// Add your subgraph client import here
// import { graphQLClient } from "@/clients/subgraph";

// Create a complete command object, not just the builder
export const sendCommand = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("send tokens to your users")
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
    )
    .addStringOption((option) =>
      option
        .setName("tag")
        .setDescription("A tag for the reward")
        .setRequired(true)
        .setMaxLength(32),
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const guildId = interaction.guildId;
    const isBot = interaction.user.bot;

    if (!guildId || isBot) {
      return interaction.respond([]);
    }

    try {
      // Get the platform connection and community info
      const platformConnection = await db.query.platformConnections.findFirst({
        where: (pc) => and(eq(pc.platformId, guildId), eq(pc.platformType, "discord")),
        with: {
          permissions: true,
          community: true,
        },
      });

      if (!platformConnection || !platformConnection.community?.communityContractChain) {
        return interaction.respond([]);
      }

      // check if user has permission (roleID) to send tokens
      const userPermissions = platformConnection?.permissions.filter((permission) => {
        if (!interaction.member?.roles || typeof interaction.member.roles === "string")
          return false;
        return (interaction.member.roles as GuildMemberRoleManager).cache.has(permission.roleId);
      });

      if (!userPermissions?.length) {
        return interaction.respond([]);
      }

      const tokens: { id: string; name: string }[] = [];

      for (const permission of userPermissions) {
        const token = await getToken(
          permission.tokenAddress as Address,
          platformConnection.community.communityContractChain,
        );
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
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (!interaction.guildId) {
        return interaction.editReply({
          content: "This command can only be used in a server.",
        });
      }

      // Get token, amount, and receiver from the command
      const token = interaction.options.getString("token", true);
      const amount = interaction.options.getNumber("amount", true);
      const receiver = interaction.options.getUser("receiver", true);
      const tag = interaction.options.getString("tag", true);

      if (receiver.bot) {
        return interaction.editReply({
          content: "Cannot send tokens to bot users.",
        });
      }

      // Get users wallet by Discord ID
      let user = await findUserByHandle(receiver.displayName);

      if (!user?.wallet) {
        try {
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
            return interaction.editReply({
              content: "Failed to create wallet for user. Please try again later.",
            });
          }

          user = {
            wallet: privyUser.wallet.address,
          };
        } catch (error) {
          console.error("Error creating user wallet:", error);
          return interaction.editReply({
            content: "Failed to create user wallet. Please try again later.",
          });
        }
      }

      // Get the platform connection from the database
      const platformConnection = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.platformId, interaction.guildId),
        with: {
          community: true,
          permissions: true,
        },
      });

      if (!platformConnection) {
        return interaction.editReply({
          content: "This server is not properly configured.",
        });
      }

      if (
        !platformConnection.community?.communityContractChain ||
        !platformConnection.community?.communityContractAddress
      ) {
        return interaction.editReply({
          content: "Community configuration is missing.",
        });
      }

      const chain = getChain(platformConnection.community.communityContractChain as ChainName);

      if (!chain) {
        return interaction.editReply({
          content: "Invalid chain configuration.",
        });
      }

      // get communityWalletId and communityWalletAddress from community
      const communityWalletId = platformConnection.community.communityWalletId;
      const communityWalletAddress = platformConnection.community.communityWalletAddress;

      if (!communityWalletId || !communityWalletAddress) {
        return interaction.editReply({
          content: "Community wallet configuration is missing.",
        });
      }

      const account = await createViemAccount({
        walletId: communityWalletId as Address,
        address: communityWalletAddress as Address,
        privy: privyClient,
      });

      const publicClient = getPublicClientByChainName(
        platformConnection.community.communityContractChain,
      );
      const walletClient = getWalletClientByChainName(
        platformConnection.community.communityContractChain,
        account,
      );

      const tokenLabel = await getTokenLabelByValue(token, interaction);

      // Fetch the user's max allowed value from the database
      const userPermission = platformConnection.permissions.find(
        (permission) => permission.tokenAddress === token,
      );
      const maxAllowed = Number(userPermission?.maxAmount) ?? 100;

      if (amount > maxAllowed) {
        return interaction.editReply({
          content: `You cannot send more than ${maxAllowed} tokens.`,
        });
      }

      try {
        const { request } = await publicClient.simulateContract({
          account,
          address: platformConnection.community.communityContractAddress as Address,
          abi: rewardFacetAbi,
          functionName: "mintERC20",
          args: [
            token as Address,
            user.wallet as Address,
            parseEther(amount.toString()),
            stringToHex(tag, { size: 32 }),
            stringToHex("MISSION", { size: 32 }),
            stringToHex(""),
          ],
        });

        let transactionHash: `0x${string}`;
        try {
          transactionHash = await walletClient.writeContract(request);
        } catch (err) {
          const error = handleViemError(err, "execution");
          return interaction.editReply(formatViemErrorForDiscord(error));
        }

        const blockExplorerUrl = chain?.BLOCK_EXPLORER_URL;
        const communitySlug = platformConnection?.community?.slug;
        const communityUrl = `${process.env.PLATFORM_URL}/${communitySlug}`;
        const transactionUrl = `${blockExplorerUrl}/tx/${transactionHash}`;

        if (interaction?.channel?.isTextBased()) {
          if (interaction.channel.type === 0) {
            const textChannel = interaction.channel as TextChannel;
            await textChannel.send({
              embeds: [
                {
                  title: `🎉 ${tokenLabel} Sent!`,
                  color: 0x00ff00,
                  fields: [
                    {
                      name: "Recipient",
                      value: `<@${receiver.id}>`,
                      inline: true,
                    },
                    {
                      name: "Reward",
                      value: `${amount} ${tokenLabel}`,
                      inline: true,
                    },
                    {
                      name: "Reason",
                      value: tag,
                      inline: true,
                    },
                    {
                      name: "Already connected your Discord?",
                      value: "Your tokens are already in your connected wallet.",
                      inline: false,
                    },
                    {
                      name: "Haven't connected your Discord yet?",
                      value: `A secure wallet has been created for you and your ${amount} ${tokenLabel} are waiting for you. Connect your Discord in the [Community Page](${communityUrl}) to claim the wallet.`,
                      inline: false,
                    },
                    {
                      name: "Links",
                      value: `[View Transaction](${transactionUrl}) • [Community Page](${communityUrl})`,
                      inline: false,
                    },
                  ],
                  footer: {
                    text: "Powered by Open Format",
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
            });
          }
        }

        return interaction.editReply({
          content: "Tokens sent successfully!",
        });
      } catch (err) {
        const error = handleViemError(err, "simulation");
        return interaction.editReply(formatViemErrorForDiscord(error));
      }
    } catch (error) {
      console.error("Command execution error:", error);
      return interaction.editReply({
        content: "An unexpected error occurred. Please try again.",
      });
    }
  },
};

async function getTokenLabelByValue(tokenValue: string, interaction: ChatInputCommandInteraction) {
  // Get the platform connection from the database (same as in autocomplete)
  const platformConnection = await db.query.platformConnections.findFirst({
    where: eq(platformConnections.platformId, interaction.guildId as string),
    with: {
      permissions: true,
      community: true,
    },
  });

  if (!platformConnection?.permissions) return tokenValue;

  for (const permission of platformConnection.permissions) {
    const tokens = await getToken(
      permission.tokenAddress as Address,
      platformConnection.community?.communityContractChain,
    );
    for (const token of tokens) {
      if (token.id === tokenValue) {
        return token.name; // or token.symbol, etc.
      }
    }
  }
  return tokenValue; // fallback to value if not found
}
