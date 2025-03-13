import { OpenAPIHono } from "@hono/zod-openapi";
import type { TextChannel } from "discord.js";
import { bearerAuth } from "hono/bearer-auth";
import { showRoutes } from "hono/dev";
import { type Address, parseEther } from "viem";
import discordClient from "./clients/discord";
import {
  contributionRewardEmbed,
  missingRewardOpportunityEmbed,
} from "./constants/discord/notifications";
import { rewardPoints } from "./lib/openformat";
import { findUserByHandle } from "./lib/privy";
import { githubWebhookMiddleware } from "./middleware/github-webhook";
import agentRoute from "./routes/agent";
import { automationsRoute } from "./routes/automations";
import { communitiesRoute } from "./routes/communities";
import docs from "./routes/docs";

if (!process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET must be set");
}

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

const app = new OpenAPIHono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("/message/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/docs/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/automations/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/communities/*", bearerAuth({ token: process.env.API_KEY as string }));

app.route("/docs", docs);
app.route("/agent", agentRoute);
app.route("/automations", automationsRoute);
app.route("/communities", communitiesRoute);

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
        // Only send Discord notification for public repos
        if (!payload.repository?.private) {
          try {
            const channel = discordClient.channels.cache.get(
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
          const channel = discordClient.channels.cache.get(
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

showRoutes(app);

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
  fetch: app.fetch,
};
