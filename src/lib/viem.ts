import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { eq } from "drizzle-orm";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { db } from "../db";
import { communities } from "../db/schema";

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY is not set");
}

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Address),
  transport: http(),
});

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string,
);

export async function getCommunityWallet(communityId: string) {
  const result = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
    columns: {
      communityWalletId: true,
      communityWalletAddress: true,
    },
  });

  if (!result) {
    throw new Error("Community or wallet not found");
  }

  return createViemAccount({
    walletId: result.communityWalletId as Address,
    address: result.communityWalletAddress as Address,
    privy,
  });
}

export function publicClientByChainName(chainName: string) {
  switch (chainName) {
    case "arbitrum-sepolia":
      return createPublicClient({
        chain: arbitrumSepolia,
        transport: http(),
      });
    default:
      throw new Error(`Unsupported chain: ${chainName}`);
  }
}
