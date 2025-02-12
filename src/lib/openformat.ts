import { type Address, stringToHex } from "viem";
import { rewardFacetAbi } from "../abis/RewardFacet";
import { publicClient, walletClient } from "./viem";

if (!process.env.COMMUNITY_ADDRESS) {
  throw new Error("COMMUNITY_ADDRESS is not set");
}

if (!process.env.POINTS_TOKEN_ADDRESS) {
  throw new Error("POINTS_TOKEN_ADDRESS is not set");
}

interface RewardPointsParams {
  user: Address;
  amount: bigint;
  rewardId: string;
  ipfsHash: string;
}

export async function rewardPoints(data: RewardPointsParams) {
  const tx = await walletClient.writeContract({
    address: process.env.COMMUNITY_ADDRESS as Address,
    abi: rewardFacetAbi,
    functionName: "mintERC20",
    args: [
      process.env.POINTS_TOKEN_ADDRESS as Address,
      data.user,
      data.amount,
      stringToHex(data.rewardId, { size: 32 }),
      stringToHex("MISSION", { size: 32 }),
      data.ipfsHash,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  return receipt.transactionHash;
}
