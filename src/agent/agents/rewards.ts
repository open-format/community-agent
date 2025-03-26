import { Agent } from '@mastra/core/agent';
import { google } from "@ai-sdk/google";

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
export async function identifyRewards(transcript: string) {
  const prompt = `Analyze this chat transcript and identify valuable community contributions that deserve recognition and rewards.

Identify any and all meaningful contributions, and if there are none, return an empty array.
Do not be afraid to identify many contributions, there is no limit to the number of contributions you can identify.
Anyone who has made a meaningful contribution should be identified.
The same person may make multiple contributions, and should be identified multiple times if they have made multiple meaningful contributions.
But the same contribution should not be identified multiple times.

For each meaningful contribution, provide:
1. Who made the contribution
2. A high-level summary (5-12 words) that quickly captures the essence of the contribution
3. A detailed description that explains the contribution in depth
4. The impact on the community
5. Evidence: an array of objects containing channelId and messageId for each message that proves this contribution
6. A short kebab-case rewardId that describes the contribution (max 32 chars)
7. Suggested rewards (10-1000 points) based on:
   - Contribution value and impact
   - Time/effort invested
   - Community benefit
   - Technical complexity

Return the response in this exact JSON format:
{
  "contributions": [
    {
      "contributor": "username",
      "summary": "Short 5-12 word summary of the contribution",
      "description": "Detailed explanation of what was contributed and how it helps",
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
        "reasoning": "Detailed explanation of reward suggestion"
      }
    }
  ]
}

Remember:
- rewardId must be in kebab-case (lowercase with hyphens)
- rewardId should be descriptive but under 32 characters
- evidence must be an array of objects with channelId and messageId
- Include ALL relevant messages that support the contribution
- Summary should be concise (5-12 words) and capture the essence
- Description should be detailed and explain the full context
- For summaries be specific within reason and start the summary as if the contributors name was before it e.g.
  - Dan_sm1th "fixed an important bug in the base code"
  - MysticMelody "helped to onboard a new user"
  - LunarWhisper "answered a question about the project's documentation"
  - CrimsonBolt "suggested a new endpoint for the API"

Chat transcript:
${transcript}`;

  const result = await rewardsAgent.generate(prompt);
  const contributions = JSON.parse(result.text.replace(/```json\n?|```/g, '').trim());
  
  return contributions;
}