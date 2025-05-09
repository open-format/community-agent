import {
  contributionRewardEmbed,
  missingRewardOpportunityEmbed,
} from "@/constants/discord/notifications";
import { rewardPoints } from "@/lib/openformat";
import { findUserByHandle } from "@/lib/privy";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { TextChannel } from "discord.js";
import type { Address } from "viem";
import { parseEther } from "viem";
import { postGithubWebhook } from "./routes";
import { CLIENTS } from "@/clients";

const webhooksRoute = new OpenAPIHono();

webhooksRoute.openapi(postGithubWebhook, async (c) => {
  const body = await c.req.text();

  try {
    const payload = JSON.parse(body);

    const commits = payload.commits || payload.repository?.commits || payload.push?.commits || [];

    if (payload.sender.type !== "User") {
      return c.json({
        message: "Not a user, ignoring",
      });
    }

    if (commits.length) {
      const user = await findUserByHandle(payload.sender.login);

      if (!user?.wallet || !user?.github?.username) {
        // Only send Discord notification for public repos
        if (!payload.repository?.private) {
          try {
            const channel = CLIENTS.discord.channels.cache.get(
              process.env.DISCORD_CHANNEL_ID as string,
            ) as TextChannel;

            if (channel) {
              await channel.send({
                embeds: [missingRewardOpportunityEmbed(payload)],
              });
            }
          } catch (error) {
            console.error("Failed to send Discord notification:", error);
          }
        }

        return c.json({
          message: `${payload.sender.login} missed reward due to incomplete profile`,
        });
      }

      const hash = await rewardPoints({
        user: user.wallet as Address,
        amount: parseEther("100"),
        rewardId: "Code contribution",
        // TODO: Store partial webhook on IPFS
        ipfsHash: "ipfs://",
      });

      // Only send Discord notification for public repos
      if (!payload.repository?.private) {
        try {
          const channel = CLIENTS.discord.channels.cache.get(
            process.env.DISCORD_CHANNEL_ID as string,
          ) as TextChannel;
          if (channel) {
            await channel.send({
              embeds: [contributionRewardEmbed(payload, user, hash)],
            });
          }
        } catch (error) {
          console.error("Failed to send Discord notification:", error);
        }
      }

      return c.json({
        message: `${payload.sender.login} pushed to ${payload.repository.name}`,
      });
    }

    return c.json({
      message: "No commits to process",
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json({ message: "Webhook processing failed" }, 500);
  }
});

export default webhooksRoute;
