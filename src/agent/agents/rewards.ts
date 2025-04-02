import { Agent } from '@mastra/core/agent';
import { google } from "@ai-sdk/google";
import { getTeamDetailsContext } from '../context-providers/team_details';
import { getTokenDetailsContext } from '../context-providers/token_details';
import { getCommunityContext } from '../context-providers/community';

export const rewardsAgent = new Agent({
  name: "community-rewards",
  instructions: `You are a community rewards analyzer that identifies valuable contributions and suggests appropriate rewards.
  
  You can analyze both full conversation transcripts and individual messages to:
  1. Identify valuable contributions
  2. Assess their impact and value
  3. Suggest appropriate reward points based on contribution quality
  
  When evaluating contributions, consider:
  - Technical value (code, documentation, tools)
  - Community support (helping others, answering questions)
  - Content creation (guides, tutorials, explanations)
  - Community building (organizing events, fostering discussions)
  - Innovation and creative problem-solving
  - Knowledge sharing and expertise
  
  Always provide clear reasoning for your reward suggestions, focusing on objective metrics for contribution value.`,
  model: google("gemini-2.0-flash-001"),
});

// Function to identify rewards from a transcript
export async function identifyRewards(transcript: string, communityId: string) {
  // Get team details context
  const teamContext = await getTeamDetailsContext(communityId);
  const tokenContext = await getTokenDetailsContext(communityId);
  const communityContext = await getCommunityContext(communityId);

  
  const prompt = `Analyze this chat transcript and identify valuable community contributions that deserve recognition and rewards.

Identify any and all meaningful contributions, and if there are none, return an empty array.
If you are identifying no contributions make sure there actually are no contributions.
Do not be afraid to identify many contributions, there is no limit to the number of contributions you can identify.
Anyone who has made a meaningful contribution should be identified (except for the specific team members which are unable to be rewarded).
The same person may make multiple contributions, and should be identified multiple times if they have made multiple meaningful contributions.
But the same contribution should not be identified multiple times.

${teamContext}

${tokenContext}

${communityContext}

For each meaningful contribution, provide:
1. Who made the contribution
2. A high-level short summary (5-12 words) that quickly captures the essence of the contribution
3. A detailed comprehensive description that explains the contribution in depth
4. The impact on the community
5. Evidence: an array of objects containing channelId and messageId for each message that proves this contribution
6. A short kebab-case rewardId that describes the contribution (max 32 chars)
7. Suggested rewards based on:
   - Contribution value and impact
   - Time/effort invested
   - Community benefit
   - Technical complexity
   - The appropriate token to use (MUST include the token address)

Return the response in this exact JSON format:
{
  "contributions": [
    {
      "contributor": "username",
      "short_summary": "Short 5-12 word summary of the contribution",
      "comprehensive_description": "Detailed explanation of what was contributed and how it helps",
      "impact": "Specific impact on community",
      "evidence": [
        {
          "channelId": "channel_id_here",
          "messageId": "message_id_here"
        }
      ],
      "rewardId": "technical-documentation-update",
      "suggested_reward": {
        "points": 100,
        "reasoning": "Detailed explanation of reward suggestion",
        "tokenAddress": "token_address_here" // MUST be the most appropriate token address provided in the context for the sppecific contribution. If no token is provided then leave blank.
      }
    }
  ]
}

Remember:
- rewardId must be in kebab-case (lowercase with hyphens)
- rewardId should be descriptive but under 32 characters
- evidence must be an array of objects with channelId and messageId
- Make sure the messageId is one of the messages that proves the contribution
- Make sure the channelId is the channel associated with the messageId
- Include ALL relevant messages that support the contribution
- The short summary should be concise (5-12 words) and capture the essence
- The comprehensive description should be detailed and explain the full context
- For the short summary be specific (within reason)
- Start the short summary as if the contributors name was before it e.g.
  - "fixed an important bug in the base code"
  - "helped to onboard a new user"
  - "answered a question about the project's documentation"
  - "suggested a new endpoint for the API"
- The comprehensive description should start with a capital letter as normal, it shouldn't be the same structure as the short summary.

Chat transcript:
${transcript}`;
  const result = await rewardsAgent.generate(prompt);
  const contributions = JSON.parse(result.text.replace(/```json\n?|```/g, '').trim());
  
  return contributions;
}