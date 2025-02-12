import { Client, GatewayIntentBits, type TextChannel } from "discord.js";
import { Hono } from "hono";
import { type Address, parseEther } from "viem";
import { rewardPoints } from "./lib/openformat";
import { findUserByHandle } from "./lib/privy";

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

// Create a Discord client
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Connect to Discord (you'll need to set DISCORD_TOKEN in your environment)
discordClient.login(process.env.DISCORD_TOKEN);

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/webhooks/github", async (c) => {
  const payload = await c.req.json();
  if (payload.sender.type !== "User") {
    return c.json({
      message: "Not a user, ignoring",
    });
  }
  if (payload?.commits?.length) {
    const user = await findUserByHandle(payload.sender.login);

    if (user?.type !== "github" || !user?.wallet) {
      return c.json({
        message: "No wallet found for github user",
      });
    }

    const hash = await rewardPoints({
      user: user.wallet as Address,
      amount: parseEther("100"),
      rewardId: "Code contribution",
      // TODO: Store partial webhook on IPFS
      ipfsHash: "ipfs://",
    });

    // Send Discord notification
    try {
      const channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID as string) as TextChannel;

      if (channel) {
        await channel.send({
          embeds: [
            {
              title: "Contribution Reward 🤘",
              description: `${payload.sender.login} pushed to ${payload.repository.name} and was rewarded 100 $DEV for their code contribution. Join ${payload.sender.login} and others contributing to Open Format. Get started - https://rewards.openformat.tech/open-format.`,
              url: payload.repository.html_url,
              color: 16766464,
              fields: [
                {
                  name: "Repository",
                  value: `[${payload.repository.full_name}](${payload.repository.html_url})`,
                  inline: true,
                },
                {
                  name: "Commits",
                  value: `${payload.commits.length}`,
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

    console.log(hash);

    return c.json({
      message: `${payload.sender.login} pushed to ${payload.repository.name}`,
    });
  }
  return c.json({
    message: "No commits found",
  });
});

export default app;
