import { Workflow, Step } from '@mastra/core/workflows';
import { z } from 'zod';
import { identifyRewards } from '../agents';
import { getMessagesTool, getWalletAddressTool, savePendingRewardTool, createPrivyWalletTool } from '../tools';
import { ThirdwebStorage } from "@thirdweb-dev/storage";

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: 'fetchMessages',
  outputSchema: z.object({
    transcript: z.string(),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (!getMessagesTool.execute) {
      throw new Error('Fetch messages tool not initialized');
    }

    // Convert to milliseconds if in seconds
    const startDate = context.triggerData.startDate.toString().length === 10 
      ? context.triggerData.startDate * 1000 
      : context.triggerData.startDate;
    
    const endDate = context.triggerData.endDate.toString().length === 10
      ? context.triggerData.endDate * 1000
      : context.triggerData.endDate;

    const result = await getMessagesTool.execute({
      context: {
        startDate,
        endDate,
        platformId: context.triggerData.platformId,
        includeStats: false,
        includeMessageId: true
      }
    });

    return { transcript: result.transcript };
  },
});

// Step 2: Identify rewards using the rewards agent
const identifyRewardsStep = new Step({
  id: 'identifyRewards',
  outputSchema: z.object({
    contributions: z.array(z.object({
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
    })),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.fetchMessages.status !== 'success') {
      throw new Error('Failed to fetch messages');
    }

    const transcript = context.steps.fetchMessages.output.transcript;
    const rewards = await identifyRewards(transcript);

    // Add Discord message URLs to each piece of evidence
    const enhancedRewards = {
      contributions: rewards.contributions.map((contribution: {
        evidence: Array<{ channelId: string; messageId: string }>;
      }) => ({
        ...contribution,
        evidence: contribution.evidence.map((evidence: { channelId: string; messageId: string }) => 
          `https://discord.com/channels/${context.triggerData.platformId}/${evidence.channelId}/${evidence.messageId}`
        )
      }))
    };

    return enhancedRewards;
  },
});

// Step 3: Get wallet addresses for contributors
const getWalletAddressesStep = new Step({
  id: 'getWalletAddresses',
  outputSchema: z.object({
    rewards: z.array(z.object({
      ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
      walletAddress: z.string().nullable(),
      isPregenerated: z.boolean().optional(),
      error: z.string().optional(),
    })),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.identifyRewards.status !== 'success') {
      throw new Error('Failed to identify rewards');
    }

    if (!getWalletAddressTool.execute) {
      throw new Error('Get wallet address tool not initialized');
    }

    const contributions = context.steps.identifyRewards.output.contributions;
    console.log(`Processing ${contributions.length} contributions for wallet addresses`);

    const rewards = await Promise.all(
      contributions.map(async (contribution) => {
        console.log(`Processing wallet for contributor: ${contribution.contributor}`);
        
        // First try to get existing wallet
        const walletInfo = await getWalletAddressTool.execute({
          context: {
            username: contribution.contributor,
            platform: 'discord'
          }
        });

        // If no wallet exists or user needs to create one, try to create one
        if (!walletInfo.walletAddress) {
          console.log(`No existing wallet found for ${contribution.contributor}, attempting to create one`);
          try {
            const privyWalletInfo = await createPrivyWalletTool.execute({
              context: {
                username: contribution.contributor,
                platform: 'discord'
              }
            });

            if (privyWalletInfo.walletAddress) {
              console.log(`Successfully created new wallet for ${contribution.contributor}: ${privyWalletInfo.walletAddress}`);
              return {
                ...contribution,
                walletAddress: privyWalletInfo.walletAddress,
                isPregenerated: true
              };
            } else {
              console.error(`Failed to create wallet for ${contribution.contributor}: No wallet address returned`);
              return {
                ...contribution,
                walletAddress: null,
                error: `Failed to create wallet: No wallet address returned`
              };
            }
          } catch (error) {
            console.error(`Failed to create wallet for ${contribution.contributor}:`, error);
            return {
              ...contribution,
              walletAddress: null,
              error: `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        }

        // If we have a wallet address, return it
        if (walletInfo.walletAddress) {
          console.log(`Found existing wallet for ${contribution.contributor}: ${walletInfo.walletAddress}`);
          return {
            ...contribution,
            walletAddress: walletInfo.walletAddress
          };
        }

        // If we get here, there was an error getting the wallet
        console.error(`Error getting wallet for ${contribution.contributor}:`, walletInfo.error);
        return {
          ...contribution,
          walletAddress: null,
          error: walletInfo.error || 'Unknown error getting wallet'
        };
      })
    ) as Array<any>;

    const successCount = rewards.filter(r => r.walletAddress).length;
    const errorCount = rewards.filter(r => r.error).length;
    console.log(`Wallet processing complete. Success: ${successCount}, Errors: ${errorCount}`);

    return { rewards };
  },
});

// Add new step for IPFS upload
const uploadMetadataStep = new Step({
  id: 'uploadMetadata',
  outputSchema: z.object({
    rewards: z.array(z.object({
      ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
      walletAddress: z.string().nullable(),
      error: z.string().optional(),
      metadataUri: z.string().optional(),
    })),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.getWalletAddresses.status !== 'success') {
      throw new Error('Failed to get wallet addresses');
    }

    const storage = new ThirdwebStorage({
      secretKey: process.env.THIRDWEB_SECRET,
      gatewayUrls: ['https://storage.thirdweb.com/ipfs/upload'],
    });

    const rewards = await Promise.all(
      context.steps.getWalletAddresses.output.rewards.map(async (reward) => {
        const metadata = {
          platform: 'discord',
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
            console.log(`Successfully uploaded metadata for ${reward.contributor}: ${ipfsHash}`);
            return {
              ...reward,
              metadataUri: ipfsHash,
            };
          } catch (error) {
            lastError = error as Error;
            retries++;
            
            if (retries < maxRetries) {
              console.log(`Retry ${retries}/${maxRetries} for ${reward.contributor} after error:`, error);
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            } else {
              console.error(`Failed to upload metadata for ${reward.contributor} after ${maxRetries} attempts:`, error);
              return {
                ...reward,
                error: `Failed to upload metadata after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }
        }

        return {
          ...reward,
          error: `Failed to upload metadata: ${lastError?.message || 'Unknown error'}`
        };
      })
    );

    return { rewards };
  },
});

// Update save to database step
const savePendingRewardsStep = new Step({
  id: 'savePendingRewards',
  outputSchema: z.object({
    savedRewards: z.array(z.object({
      id: z.string(),
      ...identifyRewardsStep.outputSchema.shape.contributions.element.shape,
      walletAddress: z.string().nullable(),
      metadataUri: z.string(),
      error: z.string().optional(),
    })),
  }),
  execute: async ({ context }: { context: WorkflowContext }) => {
    if (context.steps.uploadMetadata.status !== 'success') {
      throw new Error('Failed to upload metadata');
    }

    if (!savePendingRewardTool?.execute) {
      throw new Error('Save pending reward tool not initialized');
    }

    const rewards = context.steps.uploadMetadata.output.rewards as Array<{
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
      metadataUri?: string;
      error?: string;
    }>;
    const savedRewards = await Promise.all(
      rewards.map(async (reward) => {
        if (!reward.walletAddress) {
          return {
            ...reward,
            id: '',
            error: 'No wallet address available'
          };
        }

        const result = await (savePendingRewardTool.execute!({
          context: {
            communityId: context.triggerData.communityId,
            contributor: reward.contributor,
            walletAddress: reward.walletAddress,
            platform: 'discord',
            rewardId: reward.rewardId,
            points: reward.suggested_reward.points,
            summary: reward.short_summary,
            description: reward.comprehensive_description,
            impact: reward.impact,
            evidence: reward.evidence,
            reasoning: reward.suggested_reward.reasoning,
            metadataUri: reward.metadataUri || '',
          }
        }));

        if (result.error) {
          return {
            ...reward,
            id: '',
            error: result.error
          };
        }

        return {
          ...reward,
          id: result.id
        };
      })
    );

    return { savedRewards };
  },
});

interface WorkflowContext {
  triggerData: {
    communityId: string;
    platformId: string;
    startDate: number;
    endDate: number;
  };
  steps: {
    fetchMessages: {
      status: string;
      output: {
        transcript: string;
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
  name: 'community-rewards',
  triggerSchema: z.object({
    communityId: z.string(),
    platformId: z.string(),
    startDate: z.number()
      .refine(val => {
        const digits = Math.floor(Math.log10(val)) + 1;
        return digits === 10 || digits === 13;
      }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
    endDate: z.number()
      .refine(val => {
        const digits = Math.floor(Math.log10(val)) + 1;
        return digits === 10 || digits === 13;
      }, "Timestamp must be a UNIX timestamp in seconds or milliseconds"),
  }),
});

// Update workflow chain
rewardsWorkflow
  .step(fetchMessagesStep)
  .then(identifyRewardsStep)
  .then(getWalletAddressesStep)
  .then(uploadMetadataStep)
  .then(savePendingRewardsStep)
  .commit();