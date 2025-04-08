import { db } from '@/db';
import { communityEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getCommunityEventsContext(communityId: string): Promise<string> {
  const events = await db.query.communityEvents.findMany({
    where: eq(communityEvents.community_id, communityId),
  });

  if (!events || events.length === 0) {
    return '';
  }

  let context = 'Here are the community events:\n\n';

  events.forEach((event, index) => {
    context += `${index + 1}. ${event.name}\n`;
    context += `   Type: ${event.event_type}\n`;
    context += `   Regularity: ${event.regularity}\n`;
    context += `   Schedule: ${event.schedule}\n`;
    context += `   Description: ${event.description}\n`;
    
    if (event.rewards_description) {
      context += `   Rewards: ${event.rewards_description}\n`;
    }
    
    context += '\n';
  });

  context += 'Notes about community events:\n';
  context += '- Participation in community events is highly valued\n';
  context += '- Regular participation in events shows commitment to the community\n';
  context += '- Events help build community engagement and knowledge sharing\n';
  context += '- Community members should be rewarded in line with the rewards description\n';

  return context;
} 