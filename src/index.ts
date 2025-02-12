import { Hono } from "hono";
import type { Address } from "viem";
import { parseEther } from "viem";
import { rewardPoints } from "./lib/openformat";
import { findUserByHandle } from "./lib/privy";
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

    // TODO: Notify user in Discord

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
