import { getChainById } from "@/constants/chains";
import { gql, request } from "graphql-request";
import type { Address } from "viem";

export async function getCommunitySubgraphData(communityId: Address, chainId: number) {
  const GRAPHQL_URL = getChainById(chainId)?.SUBGRAPH_URL;

  if (!GRAPHQL_URL) {
    throw new Error("No subgraph URL found for chain");
  }

  const query = gql`
    query ($app: ID!) {
    app(id: $app) {
    id
    name
    owner {
      id
    }
    badges(orderBy: createdAt, orderDirection: desc) {
      id
      name
      metadataURI
      totalAwarded
      }
      tokens {
        id
        token {
          id
          tokenType
          name
          symbol
          createdAt
        }
      }
    }
  }
  `;

  try {
    const response = await request<{
      app: { name: string; owner: { id: string } };
    }>(GRAPHQL_URL, query, {
      app: communityId.toLowerCase(),
    });

    if (!response.app) {
      throw new Error(`No community found with ID ${communityId}`);
    }

    return response.app;
  } catch (error) {
    throw new Error(
      `Failed to fetch community data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function getToken(tokenId: Address, chainId: number) {
  const GRAPHQL_URL = getChainById(chainId)?.SUBGRAPH_URL;

  if (!GRAPHQL_URL) {
    throw new Error("No subgraph URL found for chain");
  }

  const query = gql`
   query ($tokenId: ID!) {
  fungibleTokens(where: {id: $tokenId}) {
    id
    name
      }
    }
  `;

  try {
    const response = await request<{
      fungibleTokens: { id: string; name: string }[];
    }>(GRAPHQL_URL, query, {
      tokenId: tokenId.toLocaleLowerCase(),
    });

    if (!response.fungibleTokens || response.fungibleTokens.length === 0) {
      throw new Error(`No token found with ID ${tokenId}`);
    }

    return response.fungibleTokens;
  } catch (error) {
    throw new Error(
      `Failed to fetch token data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
