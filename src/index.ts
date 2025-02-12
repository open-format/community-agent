import { Webhooks } from "@octokit/webhooks";
import { Client, GatewayIntentBits, type TextChannel } from "discord.js";
import { Hono } from "hono";
import { type Address, parseEther } from "viem";
import { rewardPoints } from "./lib/openformat";
import { findUserByHandle } from "./lib/privy";
import { githubWebhookMiddleware } from "./middleware/github-webhook";

if (!process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET must be set");
}

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

discordClient.login(process.env.DISCORD_TOKEN);

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use("/webhooks/github", githubWebhookMiddleware());

app.post("/webhooks/github", async (c) => {
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
        try {
          const channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID as string) as TextChannel;

          if (channel) {
            await channel.send({
              embeds: [
                {
                  title: "Missed Reward Opportunity 🚫",
                  description: `GitHub user ${payload.sender.login} has missed out on earning $DEV tokens for contributing. If this is you, [sign up](https://rewards.openformat.tech/open-format) to claim future rewards!`,
                  color: 16711680, // Red color
                  fields: [
                    {
                      name: "Repository",
                      value: `[${payload.repository.full_name}](${payload.repository.html_url})`,
                      inline: true,
                    },
                    {
                      name: "Commit",
                      value: `[${payload.head_commit.message.slice(0, 30)}...](${payload.head_commit.url})`,
                      inline: true,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            });
          }
        } catch (error) {
          console.error("Failed to send Discord notification:", error);
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

      try {
        const channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID as string) as TextChannel;
        if (channel) {
          await channel.send({
            embeds: [
              {
                title: "Contribution Reward 🤘",
                description: user?.discord?.id
                  ? `<@${user.discord.id}> pushed to ${payload.repository.name} and was rewarded 100 $DEV for their code contribution. Join <@${user.discord.id}> and others contributing to Open Format. Get started - https://rewards.openformat.tech/open-format`
                  : `${payload.sender.login} pushed to ${payload.repository.name} and was rewarded 100 $DEV for their code contribution. Join ${payload.sender.login} and others contributing to Open Format. Get started - https://rewards.openformat.tech/open-format`,
                url: payload.repository.html_url,
                color: 16766464,
                fields: [
                  {
                    name: "Repository",
                    value: `[${payload.repository.full_name}](${payload.repository.html_url})`,
                    inline: true,
                  },
                  {
                    name: "Commit",
                    value: `[${payload.head_commit.message.slice(0, 30)}...](${payload.head_commit.url})`,
                    inline: true,
                  },
                  {
                    name: "Reward Information",
                    value: `[View Transaction](https://sepolia.arbiscan.io/tx/${hash})`,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          });
        }
      } catch (error) {
        console.error("Failed to send Discord notification:", error);
      }

      return c.json({
        message: `${payload.sender.login} pushed to ${payload.repository.name}`,
      });
    }
    return c.json({
      message: "No commits found",
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json({ message: "Webhook processing failed" }, 500);
  }
});

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
  fetch: app.fetch,
};
