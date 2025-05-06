import { ChainName, openFormatChain, turboChain } from "@/constants/chains";
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

export function getPublicClientByChainName(chainName: string) {
  const chainMap = {
    [ChainName.ARBITRUM_SEPOLIA]: arbitrumSepolia,
    [ChainName.AURORA]: aurora,
    [ChainName.BASE]: base,
    [ChainName.TURBO]: turboChain,
    [ChainName.MATCHAIN]: matchain,
    [ChainName.OPENFORMAT]: openFormatChain,
  };

  const chain = chainMap[chainName as ChainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  return createPublicClient({
    chain,
    transport: http(),
  });
}

export function getWalletClientByChainName(chainName: string, account: Account) {
  const chainMap = {
    [ChainName.ARBITRUM_SEPOLIA]: arbitrumSepolia,
    [ChainName.AURORA]: aurora,
    [ChainName.BASE]: base,
    [ChainName.TURBO]: turboChain,
    [ChainName.MATCHAIN]: matchain,
    [ChainName.OPENFORMAT]: openFormatChain,
  };

  const chain = chainMap[chainName as ChainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  return createWalletClient({
    chain,
    account,
    transport: http(),
  });
}
