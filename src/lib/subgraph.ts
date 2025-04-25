import { gql, request } from "graphql-request";
import type { Address } from "viem";

export const chainIdToSubgraphUrl = {
  "arbitrum-sepolia":
    "https://subgraph.satsuma-prod.com/7238a0e24f3c/openformat--330570/open-format-arbitrum-sepolia/version/v0.1.1/api",
};

export async function getCommunity(
  communityId: Address,
  chainId: keyof typeof chainIdToSubgraphUrl,
) {
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

export async function getToken(tokenId: Address, chainId: keyof typeof chainIdToSubgraphUrl) {
  const GRAPHQL_URL = chainIdToSubgraphUrl[chainId];

  const query = gql`
   query ($tokenId: ID!) {
  fungibleTokens(where: {id: $tokenId}) {
    id
    name
      }
    }
  `;

  const response = await request<{
    fungibleTokens: { id: string; name: string }[];
  }>(GRAPHQL_URL, query, {
    tokenId: tokenId.toLocaleLowerCase(),
  });

  return response.fungibleTokens;
}
