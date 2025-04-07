import { db } from '@/db';
import { 
  communities, 
  teamMembers, 
  tokenDetails, 
  goodExampleRewards, 
  badExampleRewards 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Tool to update community information
 */
export const updateCommunityInfoTool = createTool({
  id: "update_community_info",
  description: "Update community information in the database",
  inputSchema: z.object({
    communityId: z.string(),
    data: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional(),
      stage: z.string().optional(),
      goals: z.array(z.string()).optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Update the community in the database
      await db.update(communities)
        .set({
          name: context.data.name,
          description: context.data.description,
          type: context.data.type,
          stage: context.data.stage,
          goals: context.data.goals,
          updatedAt: new Date(),
        })
        .where(eq(communities.id, context.communityId));
      
      return { success: true, message: 'Community information updated successfully' };
    } catch (error) {
      console.error('Error updating community information:', error);
      return { success: false, message: `Error updating community information: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to add a new team member
 */
export const addTeamMemberTool = createTool({
  id: "add_team_member",
  description: "Add a new team member or update an existing one",
  inputSchema: z.object({
    communityId: z.string(),
    data: z.object({
      discord_name: z.string(),
      role: z.string(),
      should_be_rewarded: z.boolean(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Check if team member already exists
      const existingMember = await db.query.teamMembers.findFirst({
        where: eq(teamMembers.community_id, context.communityId) && eq(teamMembers.discord_name, context.data.discord_name),
      });

      if (existingMember) {
        // Update existing team member
        await db.update(teamMembers)
          .set({
            role: context.data.role,
            should_be_rewarded: context.data.should_be_rewarded,
            updated_at: new Date(),
          })
          .where(eq(teamMembers.id, existingMember.id));
        
        return { success: true, message: 'Team member updated successfully' };
      } else {
        // Add new team member
        await db.insert(teamMembers).values({
          community_id: context.communityId,
          discord_name: context.data.discord_name,
          role: context.data.role,
          should_be_rewarded: context.data.should_be_rewarded,
        });
        
        return { success: true, message: 'Team member added successfully' };
      }
    } catch (error) {
      console.error('Error adding/updating team member:', error);
      return { success: false, message: `Error adding/updating team member: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to remove a team member
 */
export const removeTeamMemberTool = createTool({
  id: "remove_team_member",
  description: "Remove a team member from the database",
  inputSchema: z.object({
    communityId: z.string(),
    discordName: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Find the team member
      const member = await db.query.teamMembers.findFirst({
        where: eq(teamMembers.community_id, context.communityId) && eq(teamMembers.discord_name, context.discordName),
      });

      if (!member) {
        return { success: false, message: 'Team member not found' };
      }

      // Delete the team member
      await db.delete(teamMembers).where(eq(teamMembers.id, member.id));
      
      return { success: true, message: 'Team member removed successfully' };
    } catch (error) {
      console.error('Error removing team member:', error);
      return { success: false, message: `Error removing team member: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to add or update a token
 */
export const updateTokenTool = createTool({
  id: "update_token",
  description: "Add a new token or update an existing one",
  inputSchema: z.object({
    communityId: z.string(),
    data: z.object({
      token_address: z.string(),
      token_name: z.string(),
      reward_condition: z.string(),
      major_contribution_amount: z.number(),
      minor_contribution_amount: z.number(),
      additional_context: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Check if token already exists
      const existingToken = await db.query.tokenDetails.findFirst({
        where: eq(tokenDetails.community_id, context.communityId) && eq(tokenDetails.token_address, context.data.token_address),
      });

      if (existingToken) {
        // Update existing token
        await db.update(tokenDetails)
          .set({
            token_name: context.data.token_name,
            reward_condition: context.data.reward_condition,
            major_contribution_amount: context.data.major_contribution_amount,
            minor_contribution_amount: context.data.minor_contribution_amount,
            additional_context: context.data.additional_context,
            updated_at: new Date(),
          })
          .where(eq(tokenDetails.id, existingToken.id));
        
        return { success: true, message: 'Token updated successfully' };
      } else {
        // Add new token
        await db.insert(tokenDetails).values({
          community_id: context.communityId,
          token_address: context.data.token_address,
          token_name: context.data.token_name,
          reward_condition: context.data.reward_condition,
          major_contribution_amount: context.data.major_contribution_amount,
          minor_contribution_amount: context.data.minor_contribution_amount,
          additional_context: context.data.additional_context,
        });
        
        return { success: true, message: 'Token added successfully' };
      }
    } catch (error) {
      console.error('Error adding/updating token:', error);
      return { success: false, message: `Error adding/updating token: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to remove a token
 */
export const removeTokenTool = createTool({
  id: "remove_token",
  description: "Remove a token from the database",
  inputSchema: z.object({
    communityId: z.string(),
    tokenAddress: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Find the token
      const token = await db.query.tokenDetails.findFirst({
        where: eq(tokenDetails.community_id, context.communityId) && eq(tokenDetails.token_address, context.tokenAddress),
      });

      if (!token) {
        return { success: false, message: 'Token not found' };
      }

      // Delete the token
      await db.delete(tokenDetails).where(eq(tokenDetails.id, token.id));
      
      return { success: true, message: 'Token removed successfully' };
    } catch (error) {
      console.error('Error removing token:', error);
      return { success: false, message: `Error removing token: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to add a good example reward
 */
export const addGoodExampleRewardTool = createTool({
  id: "add_good_example_reward",
  description: "Add a good example reward to the database",
  inputSchema: z.object({
    communityId: z.string(),
    data: z.object({
      contributor: z.string(),
      short_summary: z.string(),
      comprehensive_description: z.string(),
      impact: z.string(),
      evidence: z.array(z.string()),
      reward_id: z.string(),
      suggested_reward: z.object({
        points: z.number(),
        reasoning: z.string(),
        tokenAddress: z.string(),
      }),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Add new good example reward
      await db.insert(goodExampleRewards).values({
        community_id: context.communityId,
        contributor: context.data.contributor,
        short_summary: context.data.short_summary,
        comprehensive_description: context.data.comprehensive_description,
        impact: context.data.impact,
        evidence: context.data.evidence,
        reward_id: context.data.reward_id,
        suggested_reward: context.data.suggested_reward,
      });
      
      return { success: true, message: 'Good example reward added successfully' };
    } catch (error) {
      console.error('Error adding good example reward:', error);
      return { success: false, message: `Error adding good example reward: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to add a bad example reward
 */
export const addBadExampleRewardTool = createTool({
  id: "add_bad_example_reward",
  description: "Add a bad example reward to the database",
  inputSchema: z.object({
    communityId: z.string(),
    data: z.object({
      contributor: z.string(),
      short_summary: z.string(),
      evidence: z.array(z.string()),
      why_not_reward: z.string(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Add new bad example reward
      await db.insert(badExampleRewards).values({
        community_id: context.communityId,
        contributor: context.data.contributor,
        short_summary: context.data.short_summary,
        evidence: context.data.evidence,
        why_not_reward: context.data.why_not_reward,
      });
      
      return { success: true, message: 'Bad example reward added successfully' };
    } catch (error) {
      console.error('Error adding bad example reward:', error);
      return { success: false, message: `Error adding bad example reward: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to remove a good example reward
 */
export const removeGoodExampleRewardTool = createTool({
  id: "remove_good_example_reward",
  description: "Remove a good example reward from the database",
  inputSchema: z.object({
    communityId: z.string(),
    rewardId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Find the good example reward
      const reward = await db.query.goodExampleRewards.findFirst({
        where: eq(goodExampleRewards.community_id, context.communityId) && eq(goodExampleRewards.id, context.rewardId),
      });

      if (!reward) {
        return { success: false, message: 'Good example reward not found' };
      }

      // Delete the good example reward
      await db.delete(goodExampleRewards).where(eq(goodExampleRewards.id, reward.id));
      
      return { success: true, message: 'Good example reward removed successfully' };
    } catch (error) {
      console.error('Error removing good example reward:', error);
      return { success: false, message: `Error removing good example reward: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
});

/**
 * Tool to remove a bad example reward
 */
export const removeBadExampleRewardTool = createTool({
  id: "remove_bad_example_reward",
  description: "Remove a bad example reward from the database",
  inputSchema: z.object({
    communityId: z.string(),
    rewardId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Find the bad example reward
      const reward = await db.query.badExampleRewards.findFirst({
        where: eq(badExampleRewards.community_id, context.communityId) && eq(badExampleRewards.id, context.rewardId),
      });

      if (!reward) {
        return { success: false, message: 'Bad example reward not found' };
      }

      // Delete the bad example reward
      await db.delete(badExampleRewards).where(eq(badExampleRewards.id, reward.id));
      
      return { success: true, message: 'Bad example reward removed successfully' };
    } catch (error) {
      console.error('Error removing bad example reward:', error);
      return { success: false, message: `Error removing bad example reward: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
}); 