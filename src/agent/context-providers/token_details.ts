import { db } from '@/db';
import { tokenDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

  tokens.forEach((token, index) => {
    context += `${index + 1}. ${token.token_name}\n`;
    context += `   - Token Address: ${token.token_address} (This address MUST be included in the output for this token to be used)\n`;
    context += `   - When choosing this token use the following as a rough guideline on the ballpark figure for how much to reward: `
    context += `   - For a major contribution ${token.major_contribution_amount} tokens would be appropriate and for a minor contribution ${token.minor_contribution_amount} tokens would be appropriate.` 
    context += `   - These token amounts are just a rough guideline and you should adjust the amount based on the actual contributions and the impact they have.\n`;
    context += `   - When to choose this token: ${token.reward_condition}\n`;
    if (token.additional_context) {
      context += `   - Additional Context: ${token.additional_context}\n`;
    }
    context += '\n';
  });

  context += 'Remember: You MUST include the token address in your output for each contribution to specify which token should be used for the reward.';

  return context;
} 