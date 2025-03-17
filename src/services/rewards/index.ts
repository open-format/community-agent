import { createWalletClient, http, parseEther, stringToHex, type Address } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { rewardFacetAbi } from "../../abis/RewardFacet";
import type { Automation } from "../../db/schema";
import { findUserByHandle } from "../../lib/privy";
import { getCommunityWallet } from "../../lib/viem";
import type { EventTrigger } from "../../types";

export async function distributeReward(event: EventTrigger, rule: Automation) {
  const user = await findUserByHandle(event.userId);

  if (!user?.wallet) {
    console.error("User not found");
    return;
  }

  const account = await getCommunityWallet(rule.communityId);

  const client = createWalletClient({
    account,
    //@TODO - Dynamic fetch chain from request
    chain: arbitrumSepolia,
    transport: http(),
  });

  // @TODO - Check rule.rewardType and call the appropriate function
  const hash = await client.writeContract({
    address: rule.communityId as Address,
    abi: rewardFacetAbi,
    functionName: "mintERC20",
    args: [
      rule.rewardTokenAddress as Address,
      user?.wallet as Address,
      parseEther(rule.rewardAmount as string),
      stringToHex(rule.eventType, { size: 32 }),
      stringToHex("MISSION", { size: 32 }),
      "ipfs://",
    ],
  });

  console.log(hash);

  return hash;
}
