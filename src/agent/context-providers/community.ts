import { db } from '@/db';
import { communities } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getCommunityContext(communityId: string): Promise<string> {
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  }) as Community | undefined;

  if (!community) {
    return '';
  }

  let context = `The community is called ${community.name}. Here is some useful context about the community:\n\n`;

  if (community.description) {
    context += `Community Description: ${community.description}\n\n`;
  }
  if (community.type) {
    context += `Here's a bit more information about the type of community it is: ${community.type}\n`;
  }
  if (community.stage) {
    context += `Here's a bit more information about the stage the community is at: ${community.stage}\n`;
  }
  if (community.goals && community.goals.length > 0) {
    context += 'Community Goals:\n';
    community.goals.forEach((goal: string, index: number) => {
      context += `${index + 1}. ${goal}\n`;
    });
    context += '\n';
    context += '- Contributions that directly or indirectly support the community goals should receive higher rewards\n';
    context += '- Contributions that help achieve multiple goals should be rewarded very generously\n';
    context += '- When describing the impact of a contribution and the reasoning for the reward amount, explain this, where possible, in terms of the community goals. Be specific about which goal(s) it helps achieve\n';
    context += '- It\'s very important to remember that rewards can still be given for contributions that don\'t directly support the community goals.\n';
  }

  return context;
} 