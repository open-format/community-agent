import { db } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getTeamDetailsContext(communityId: string): Promise<string> {
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.community_id, communityId),
  });

  if (members.length === 0) {
    return '';
  }

  const nonRewardableMembers = members.filter(m => !m.should_be_rewarded);
  const rewardableMembers = members.filter(m => m.should_be_rewarded);

  let context = 'This is the list of team members for the community. It should not effect the reward eligibility of any users who are not on this list.\n';

  if (nonRewardableMembers.length > 0) {
    context += 'These users should NOT be given rewards under any circumstances. They should NOT be rewarded even if they make meaningful contributions. NEVER NEVER NEVER reward these users:\n';
    nonRewardableMembers.forEach(member => {
      context += `- ${member.discord_name} (who's role is: ${member.role})\n`;
    });
    context += '\n';
  }

  if (rewardableMembers.length > 0) {
    context += 'These users ARE eligible for rewards. They should be rewarded as normal for their contributions:\n';
    rewardableMembers.forEach(member => {
      context += `- ${member.discord_name} (who's role is: ${member.role})\n`;
    });
    context += '\n';
  }

  return context;
}
