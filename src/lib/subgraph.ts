import { type ChainName, getChain } from "@/constants/chains";
import { gql, request } from "graphql-request";
import type { Address } from "viem";

export async function getCommunitySubgraphData(
  communityId: Address,
  chainId: keyof typeof ChainName,
) {
  const GRAPHQL_URL = getChain(chainId as ChainName)?.SUBGRAPH_URL;

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

  const response = await request<{
    app: { name: string; owner: { id: string } };
  }>(GRAPHQL_URL, query, {
    app: communityId.toLowerCase(),
  });

  return response.app;
}

export async function getToken(tokenId: Address, chainId: keyof typeof ChainName) {
  const GRAPHQL_URL = getChain(chainId as ChainName)?.SUBGRAPH_URL;

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

  const response = await request<{
    fungibleTokens: { id: string; name: string }[];
  }>(GRAPHQL_URL, query, {
    tokenId: tokenId.toLocaleLowerCase(),
  });

  return response.fungibleTokens;
}
