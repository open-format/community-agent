import { gql, request } from "graphql-request";
import type { Address } from "viem";

export const chainIdToSubgraphUrl = {
  "arbitrum-sepolia":
    "https://subgraph.satsuma-prod.com/7238a0e24f3c/openformat--330570/open-format-arbitrum-sepolia/version/v0.1.1/api",
};

export async function getCommunity(communityId: Address, chainId: keyof typeof chainIdToSubgraphUrl) {
  const GRAPHQL_URL = chainIdToSubgraphUrl[chainId];

  const query = gql`
    query ($communityId: ID!) {
      app(id: $communityId) {
        id
        name
        owner {
          id
        }
      }
    }
  `;

  const response = await request<{
    app: { name: string; owner: { id: string } };
  }>(GRAPHQL_URL, query, {
    communityId,
  });

  return response.app;
}

/**
 * Fetches recent token rewards for a specific community and token
 */
export async function getRecentTokenRewards(
  communityId: string, 
  tokenAddress: string, 
  chainId: keyof typeof chainIdToSubgraphUrl = "arbitrum-sepolia"
) {
  const GRAPHQL_URL = chainIdToSubgraphUrl[chainId];
  
  const query = gql`
    query getRecentTokenRewards {
      rewards(
        orderBy: createdAt, 
        orderDirection: desc, 
        first: 10, 
        where: {
          app: "${communityId}",
          token: "${tokenAddress}"
        }
      ) {
        rewardId
        user {
          id
        }
        metadataURI
        token {
          name
        }
        tokenAmount
      }
    }
  `;

  try {
    const response = await request<{
      rewards: Array<{
        rewardId: string;
        user: { id: string };
        metadataURI: string;
        token: { name: string };
        tokenAmount: string;
      }>;
    }>(GRAPHQL_URL, query);

    return response.rewards || [];
  } catch (error) {
    console.error('Error fetching token rewards:', error);
    return [];
  }
}
