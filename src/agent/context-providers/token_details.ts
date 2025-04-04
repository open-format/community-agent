import { db } from '@/db';
import { tokenDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getRecentTokenRewards } from '@/lib/subgraph';
import { getMetadata } from '@/lib/thirdweb';

export interface TokenDetails {
  tokenAddress: string;
  tokenName: string;
  rewardCondition: string;
  majorContributionAmount: number;
  minorContributionAmount: number;
  additionalContext?: string;
}

export async function getTokenDetailsContext(communityId: string): Promise<string> {
  const tokens = await db.query.tokenDetails.findMany({
    where: eq(tokenDetails.community_id, communityId),
  });

  if (tokens.length === 0) {
    return 'Reward 10-100 tokens for a minor contribution and 200-1000 tokens for a major contribution.';
  }

  let context = tokens.length === 1 
    ? 'There is only one token available for rewards. This token should be used for all contributions.\n\n'
    : 'This is the list of available tokens for rewards. Choose the appropriate token for each contribution. Make this decision based on all the context provideded including any information about team members etc. Include whichever token address you choose in the output.\n\n';

  // Fetch previous rewards for each token
  for (const token of tokens) {
    context += `${token.token_name}\n`;
    context += `   - Token Address: ${token.token_address} (This address MUST be included in the output for this token to be used)\n`;
    context += `   - When choosing this token use the following as a rough guideline on the ballpark figure for how much to reward: `
    context += `   - For a major contribution ${token.major_contribution_amount} tokens would be appropriate and for a minor contribution ${token.minor_contribution_amount} tokens would be appropriate.` 
    context += `   - These token amounts are just a rough guideline and you should adjust the amount based on the actual contributions and the impact they have.\n`;
    context += `   - When to choose this token: ${token.reward_condition}\n`;
    if (token.additional_context) {
      context += `   - Additional Context: ${token.additional_context}\n`;
    }
    
    // Add previous rewards for this token if available
    try {
      const rawRewards = await getRecentTokenRewards(communityId, token.token_address);
      
      if (rawRewards.length > 0) {
        // Process rewards with metadata
        const processedRewards = await Promise.all(
          rawRewards.map(async (reward) => {
            try {
              const metadata = await getMetadata(reward.metadataURI);
              return {
                rewardId: reward.rewardId,
                userId: reward.user.id,
                tokenName: reward.token.name,
                tokenAmount: (Number(reward.tokenAmount) / 1e18).toString(),
                metadata
              };
            } catch (error) {
              console.error(`Error fetching metadata for token reward ${reward.rewardId}:`, error);
              return {
                rewardId: reward.rewardId,
                userId: reward.user.id,
                tokenName: reward.token.name,
                tokenAmount: (Number(reward.tokenAmount) / 1e18).toString()
              };
            }
          })
        );
        
        context += `   - Previous Rewards (use as a reference for amount):\n`;
        processedRewards.forEach((reward, index) => {
          context += `     ${index + 1}. Reward ID: ${reward.rewardId}\n`;
          context += `        User: ${reward.userId}\n`;
          context += `        Amount: ${reward.tokenAmount}\n`;
          
          // Add metadata if available, focusing on impact and reasoning
          if (reward.metadata) {
            // Check for specific fields we expect in the reward workflow
            if (reward.metadata.impact) {
              context += `        Impact: ${reward.metadata.impact}\n`;
            }
            if (reward.metadata.reasoning) {
              context += `        Reasoning: ${reward.metadata.reasoning}\n`;
            }
            if (reward.metadata.short_summary) {
              context += `        Summary: ${reward.metadata.short_summary}\n`;
            }
            if (reward.metadata.comprehensive_description) {
              context += `        Description: ${reward.metadata.comprehensive_description}\n`;
            }
            
            // If we have metadata but none of the expected fields, show the raw JSON
            const hasExpectedFields = reward.metadata.impact || 
                                     reward.metadata.reasoning || 
                                     reward.metadata.short_summary || 
                                     reward.metadata.comprehensive_description;
                                     
            if (!hasExpectedFields) {
              context += `        Metadata: ${JSON.stringify(reward.metadata)}\n`;
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error fetching previous rewards for token ${token.token_name}:`, error);
      // Continue without previous rewards - don't let this error affect the rest of the token details
    }
    
    context += '\n';
  }

  context += 'Remember: You MUST include the token address in your output for each contribution to specify which token should be used for the reward.';
  context += '\n\nIMPORTANT INSTRUCTIONS FOR REWARD AMOUNTS:';
  context += '\n- Use the previous rewards as a reference for evaluating new contributions when available';
  context += '\n- Consider the reward amounts and types when suggesting new rewards';
  context += '\n- Maintain consistency in reward amounts for similar contributions';
  context += '\n- If a contribution is similar to a previous one, consider using a similar reward amount';
  context += '\n- The more recent the reward, the more weight it should have when determining the reward amount';

  return context;
} 