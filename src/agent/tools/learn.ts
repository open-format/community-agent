import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { performCommunityScopedSimilaritySearch } from "../../lib/document_processing";

export const learnTool = tool(
  async (input, config) => {
    try {
      console.log("learnTool: input");
      const communityId = config.configurable.metadata.community.id;

      // Perform similarity search in community documents
      const searchResults = await performCommunityScopedSimilaritySearch(
        communityId,
        input.query,
        input.k || 5 // Default to 5 results if not specified
      );

      return JSON.stringify({
        results: searchResults.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
        message: "Community knowledge search completed",
        status: "success",
      });
    } catch (error) {
      console.error("Error in learn tool:", error);
      return JSON.stringify({
        error: "Failed to perform learn action",
        status: "error",
      });
    }
  },
  {
    name: "learn_community",
    description: "Search and retrieve knowledge from community documents",
    schema: z.object({
      query: z.string().describe("Search query for community knowledge"),
      k: z.number().optional().describe("Number of search results to return (default: 5)"),
    }),
  }
);
