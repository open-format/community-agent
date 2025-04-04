import { db } from '@/db';
import { goodExampleRewards, badExampleRewards } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getExampleRewardsContext(communityId: string): Promise<string> {
  // Fetch good examples
  const goodExamples = await db.query.goodExampleRewards.findMany({
    where: eq(goodExampleRewards.community_id, communityId),
    limit: 5,
  });

  // Fetch bad examples
  const badExamples = await db.query.badExampleRewards.findMany({
    where: eq(badExampleRewards.community_id, communityId),
    limit: 5,
  });

  let context = 'Here are some examples of contributions and how they should be evaluated for rewards:\n\n';

  // Add good examples
  if (goodExamples.length > 0) {
    context += 'GOOD EXAMPLES - These are examples of valuable contributions that should be rewarded:\n\n';
    goodExamples.forEach((example, index) => {
      context += `${index + 1}. Contribution by ${example.contributor}:\n`;
      if (example.evidence && example.evidence.length > 0) {
        context += `   Evidence:\n`;
        example.evidence.forEach((evidence, i) => {
          context += `   - ${evidence}\n`;
        });
      }
      context += `   Summary: ${example.short_summary}\n`;
      context += `   Description: ${example.comprehensive_description}\n`;
      context += `   Impact: ${example.impact}\n`;
      context += `   Suggested Reward: ${example.suggested_reward.points} points\n`;
      context += `   Reasoning: ${example.suggested_reward.reasoning}\n`;
      context += `   Token: ${example.suggested_reward.tokenAddress}\n\n`;
    });
  }

  // Add bad examples
  if (badExamples.length > 0) {
    context += 'BAD EXAMPLES - These are examples of contributions that should NOT be rewarded:\n\n';
    badExamples.forEach((example, index) => {
      context += `${index + 1}. Contribution by ${example.contributor}:\n`;
      if (example.evidence && example.evidence.length > 0) {
        context += `   Evidence:\n`;
        example.evidence.forEach((evidence, i) => {
          context += `   - ${evidence}\n`;
        });
      }
      context += `   Summary: ${example.short_summary}\n`;
      context += `   This contribution should not be rewarded because: ${example.why_not_reward}\n\n`;
    });
  }

  // Add general guidance
  context += 'General Guidelines:\n';
  context += '- Use these examples as a reference for evaluating similar contributions\n';
  context += '- The suggested reward amounts here should be in a similar ballpark to the rewards that are suggested in the community for similar contributions\n';
  context += '- Pay attention to the reasoning and impact descriptions in good examples\n';
  context += '- Learn from the explanations in bad examples to avoid rewarding similar low-value contributions\n';
  context += '- Remember that these are examples and guidelines, not strict rules\n';
  context += '- Always evaluate each contribution on its own merits\n';

  return context;
} 