import { openFormatChain, turboChain } from "@/constants/chains";
import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { eq } from "drizzle-orm";
import { Account, type Address, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, aurora, base, matchain } from "viem/chains";
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

const viemChainMap: Record<number, any> = {
  [arbitrumSepolia.id]: arbitrumSepolia,
  [aurora.id]: aurora,
  [base.id]: base,
  [matchain.id]: matchain,
  [turboChain.id]: turboChain,
  [openFormatChain.id]: openFormatChain,
};

export function getPublicClientByChainId(chainId: number) {
  const chain = viemChainMap[chainId];

  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(),
  });
}

export function getWalletClientByChainId(chainId: number, account: Account) {
  const chain = viemChainMap[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  return createWalletClient({
    chain,
    account,
    transport: http(),
  });
}
