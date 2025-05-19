import { WorkflowContext } from "@mastra/core/dist/workflows";
import { Step, Workflow } from "@mastra/core/workflows";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
import dayjs from "dayjs";
import pino from "pino";
import { z } from "zod";
import { identifyRewards } from "../agents";
import { vectorStore } from "../stores";
import {
  createPrivyWalletTool,
  getMessagesTool,
  getWalletAddressTool,
  savePendingRewardTool,
} from "../tools";

// Create a logger instance
const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
    messages: z.array(z.string()),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting fetchMessages step");
    try {
      if (!getMessagesTool.execute) {
        throw new Error("Fetch messages tool not initialized");
      }

      const result = await getMessagesTool.execute({
        context: {
          startDate: context.triggerData.start_date,
          endDate: context.triggerData.end_date,
          platformIds: [context.triggerData.platform_id],
          includeStats: false,
          includeMessageId: true,
          checkedForReward: false,
        },
      });

      logger.info("✅ fetchMessages step completed successfully");

      return { transcript: result.transcript, messages: result.messages ?? [] };
    } catch (error) {
      logger.error("❌ fetchMessages step failed:", error instanceof Error ? error.message : error);
      throw error;
    }
  },
});

// Step 2: Identify rewards
const identifyRewardsStep = new Step({
  id: "identifyRewards",
  outputSchema: z.object({
    contributions: z.array(
      z.object({
        contributor: z.string(),
        short_summary: z.string(),
        comprehensive_description: z.string(),
        impact: z.string(),
        evidence: z.array(z.string()),
        rewardId: z.string(),
        suggested_reward: z.object({
          points: z.number(),
          reasoning: z.string(),
        }),
      }),
    ),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting identifyRewards step");
    try {
      if (context.steps.fetchMessages.status !== "success") {
        throw new Error("Failed to fetch messages");
      }

      const transcript = context.steps.fetchMessages.output.transcript;
      const rewards = await identifyRewards(transcript);

      const enhancedRewards = {
        contributions: rewards.contributions.map(
          (contribution: {
            evidence: Array<{ channelId: string; messageId: string }>;
          }) => ({
            ...contribution,
            evidence: contribution.evidence.map(
              (evidence: { channelId: string; messageId: string }) =>
                `https://discord.com/channels/${context.triggerData.platform_id}/${evidence.channelId}/${evidence.messageId}`,
            ),
          }),
        ),
      };

      logger.info("✅ identifyRewards step completed successfully");
      return enhancedRewards;
    } catch (error) {
      logger.error(
        "❌ identifyRewards step failed:",
        error instanceof Error ? error.message : error,
      );
      logger.error(error);
      throw error;
    }
  },
});

// Step 3: Get wallet addresses
const getWalletAddressesStep = new Step({
  id: "getWalletAddresses",
  outputSchema: z.object({
    rewards: z.array(
      z.object({
        ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
        walletAddress: z.string().nullable(),
        isPregenerated: z.boolean().optional(),
        error: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting getWalletAddresses step");
    try {
      if (context.steps.identifyRewards.status !== "success") {
        throw new Error("Failed to identify rewards");
      }

      if (!getWalletAddressTool.execute) {
        throw new Error("Get wallet address tool not initialized");
      }

      const contributions = context.steps.identifyRewards.output.contributions;
      const rewards = await Promise.all(
        contributions.map(async (contribution) => {
          // First try to get existing wallet
          const walletInfo = await getWalletAddressTool.execute({
            context: {
              username: contribution.contributor,
              platform: "discord",
            },
          });

          // If no wallet exists or user needs to create one, try to create one
          if (!walletInfo.walletAddress) {
            try {
              const privyWalletInfo = await createPrivyWalletTool.execute({
                context: {
                  username: contribution.contributor,
                  platform: "discord",
                },
              });

              if (privyWalletInfo.walletAddress) {
                return {
                  ...contribution,
                  walletAddress: privyWalletInfo.walletAddress,
                  isPregenerated: true,
                };
              } else {
                return {
                  ...contribution,
                  walletAddress: null,
                  error: `Failed to create wallet: No wallet address returned`,
                };
              }
            } catch (error) {
              console.error(`Failed to create wallet for ${contribution.contributor}:`, error);
              return {
                ...contribution,
                walletAddress: null,
                error: `Failed to create wallet: ${error instanceof Error ? error.message : "Unknown error"}`,
              };
            }
          }

          // If we have a wallet address, return it
          if (walletInfo.walletAddress) {
            return {
              ...contribution,
              walletAddress: walletInfo.walletAddress,
            };
          }

          // If we get here, there was an error getting the wallet
          console.error(`Error getting wallet for ${contribution.contributor}:`, walletInfo.error);
          return {
            ...contribution,
            walletAddress: null,
            error: walletInfo.error || "Unknown error getting wallet",
          };
        }),
      );

      logger.info("✅ getWalletAddresses step completed successfully");
      return { rewards };
    } catch (error) {
      logger.error(
        "❌ getWalletAddresses step failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  },
});

// Step 4: Upload metadata
const uploadMetadataStep = new Step({
  id: "uploadMetadata",
  outputSchema: z.object({
    rewards: z.array(
      z.object({
        ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
        walletAddress: z.string().nullable(),
        error: z.string().optional(),
        metadataUri: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting uploadMetadata step");
    try {
      if (context.steps.getWalletAddresses.status !== "success") {
        throw new Error("Failed to get wallet addresses");
      }

      const storage = new ThirdwebStorage({
        secretKey: process.env.THIRDWEB_SECRET,
        gatewayUrls: ["https://storage.thirdweb.com/ipfs/upload"],
      });

      const rewards = await Promise.all(
        context.steps.getWalletAddresses.output.rewards.map(async (reward) => {
          const metadata = {
            platform: "discord",
            description: reward.comprehensive_description,
            impact: reward.impact,
            evidence: reward.evidence,
            reasoning: reward.suggested_reward.reasoning,
            timestamp: Date.now(),
          };

          let retries = 0;
          const maxRetries = 3;
          let lastError: Error | null = null;

          while (retries < maxRetries) {
            try {
              const ipfsHash = await storage.upload(metadata, {
                uploadWithoutDirectory: true,
              });
              return {
                ...reward,
                metadataUri: ipfsHash,
              };
            } catch (error) {
              lastError = error as Error;
              retries++;

              if (retries < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
              } else {
                console.error(
                  `Failed to upload metadata for ${reward.contributor} after ${maxRetries} attempts:`,
                  error,
                );
                return {
                  ...reward,
                  error: `Failed to upload metadata after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
                };
              }
            }
          }

          return {
            ...reward,
            error: `Failed to upload metadata: ${lastError?.message || "Unknown error"}`,
          };
        }),
      );

      logger.info("✅ uploadMetadata step completed successfully");
      return { rewards };
    } catch (error) {
      logger.error(
        "❌ uploadMetadata step failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  },
});

// Step 5: Save pending rewards
const savePendingRewardsStep = new Step({
  id: "savePendingRewards",
  outputSchema: z.object({
    savedRewards: z.array(
      z.object({
        id: z.string(),
        ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
        walletAddress: z.string().nullable(),
        metadataUri: z.string(),
        error: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting savePendingRewards step");
    try {
      if (context.steps.uploadMetadata.status !== "success") {
        throw new Error("Failed to upload metadata");
      }

      if (!savePendingRewardTool?.execute) {
        throw new Error("Save pending reward tool not initialized");
      }

      const rewards = context.steps.uploadMetadata.output.rewards;
      const savedRewards = await Promise.all(
        rewards.map(async (reward) => {
          if (!reward.walletAddress) {
            return {
              ...reward,
              id: "",
              error: "No wallet address available",
            };
          }

          const result = await savePendingRewardTool.execute!({
            context: {
              communityId: context.triggerData.community_id,
              contributor: reward.contributor,
              walletAddress: reward.walletAddress,
              platform: "discord",
              rewardId: reward.rewardId,
              points: reward.suggested_reward.points,
              summary: reward.short_summary,
              description: reward.comprehensive_description,
              impact: reward.impact,
              evidence: reward.evidence,
              reasoning: reward.suggested_reward.reasoning,
              metadataUri: reward.metadataUri || "",
            },
          });

          if (result.error) {
            return {
              ...reward,
              id: "",
              error: result.error,
            };
          }

          return {
            ...reward,
            id: result.id,
          };
        }),
      );

      logger.info("✅ savePendingRewards step completed successfully");
      return { savedRewards };
    } catch (error) {
      logger.error(
        "❌ savePendingRewards step failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  },
});

// Step 6: Update checked for reward
const updateCheckedForRewardStep = new Step({
  id: "updateCheckedForReward",
  outputSchema: z.boolean(),
  execute: async ({ context }: { context: WorkflowContext }) => {
    logger.info("Starting updateCheckedForReward step");
    try {
      if (context.steps.fetchMessages.output.messages.length === 0) {
        logger.info("❌ No messages found or no messages to update");
        return;
      }

      for (const message of context.steps.fetchMessages.output.messages) {
        await vectorStore.updateIndexById("community_messages", message.id, {
          metadata: { ...message.metadata, checkedForReward: true },
        });
      }

      logger.info("✅ updateCheckedForReward step completed successfully");
      return true;
    } catch (error) {
      logger.error("❌ updateCheckedForReward step failed:");
      console.error(error);
      throw error;
    }
  },
});

interface WorkflowContext {
  triggerData: {
    community_id: string;
    platform_id: string;
    start_date: number;
    end_date: number;
  };
  steps: {
    fetchMessages: {
      status: string;
      output: {
        transcript: string;
        messages: {
          id: string;
          metadata: MessageMetadata;
        }[];
      };
    };
    identifyRewards: {
      status: string;
      output: {
        contributions: Array<{
          contributor: string;
          short_summary: string;
          comprehensive_description: string;
          impact: string;
          evidence: Array<{
            channelId: string;
            messageId: string;
          }>;
          rewardId: string;
          suggested_reward: {
            points: number;
            reasoning: string;
          };
        }>;
      };
    };
    getWalletAddresses: {
      status: string;
      output: {
        rewards: Array<{
          contributor: string;
          short_summary: string;
          comprehensive_description: string;
          impact: string;
          evidence: Array<{
            channelId: string;
            messageId: string;
          }>;
          rewardId: string;
          suggested_reward: {
            points: number;
            reasoning: string;
          };
          walletAddress: string | null;
          error?: string;
        }>;
      };
    };
    uploadMetadata: {
      status: string;
      output: {
        rewards: Array<{
          contributor: string;
          short_summary: string;
          comprehensive_description: string;
          impact: string;
          evidence: Array<{
            channelId: string;
            messageId: string;
          }>;
          rewardId: string;
          suggested_reward: {
            points: number;
            reasoning: string;
          };
          walletAddress: string | null;
          error?: string;
          metadataUri?: string;
        }>;
      };
    };
  };
}

export const rewardsWorkflow = new Workflow({
  name: "community-rewards",
  triggerSchema: z.object({
    community_id: z.string(),
    platform_id: z.string(),
    start_date: z
      .string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform((val) => dayjs(val).valueOf()),
    end_date: z
      .string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform((val) => dayjs(val).valueOf()),
  }),
});

// Update workflow chain
rewardsWorkflow
  .step(fetchMessagesStep)
  .then(identifyRewardsStep)
  .then(getWalletAddressesStep)
  .then(uploadMetadataStep)
  .then(savePendingRewardsStep)
  .then(updateCheckedForRewardStep)
  .commit();
