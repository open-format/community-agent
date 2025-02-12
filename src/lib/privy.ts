import { PrivyClient } from "@privy-io/server-auth";

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error("Privy app ID or secret is not set");
}

const privyClient = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);

export async function findUserByHandle(handle: string): Promise<{
  type: "discord" | "github";
  username: string | null;
  wallet: string | null;
} | null> {
  if (!handle || typeof handle !== "string") {
    return null;
  }

  try {
    const [discordUser, githubUser] = await Promise.all([
      privyClient.getUserByDiscordUsername(handle).catch(() => null),
      privyClient.getUserByGithubUsername(handle).catch(() => null),
    ]);

    // Return the first non-null user found
    if (discordUser) {
      return {
        type: "discord",
        username: discordUser.discord?.username ?? null,
        wallet: discordUser.wallet?.address ?? null,
      };
    }

    if (githubUser) {
      return {
        type: "github",
        username: githubUser.github?.username ?? null,
        wallet: githubUser.wallet?.address ?? null,
      };
    }

    return null;
  } catch (error) {
    console.error("Error searching for user:", {
      handle,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
