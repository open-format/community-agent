export async function getRewardIdsContext(): Promise<string> {
  let context = 'Available Reward IDs - When assigning rewards, use ONLY one of these specific reward IDs:\n\n';

  // Technical Category
  context += 'TECHNICAL CATEGORY:\n';
  context += '1. fixed-bug - Awarded when a member diagnoses and resolves an existing bug in the codebase.\n';
  context += '2. added-new-feature - Awarded when someone successfully implements a new functionality or enhancement.\n';
  context += '3. improved-docs - Awarded for updating or expanding documentation to make the project easier to understand.\n';
  context += '4. helped-another-dev - Awarded when a member provides meaningful dev assistance that solves another developer\'s issue.\n';
  context += '5. reviewed-code - Awarded for providing constructive feedback on someone else\'s pull request or code snippet.\n';
  context += '6. asked-technical-question - Awarded for posing a thoughtful technical question that fosters deeper discussion or problem-solving.\n';
  context += '7. answered-technical-question - Awarded for giving a clear, helpful, and accurate response to a technical inquiry.\n';
  context += '8. shared-technical-resource - Awarded for posting tools, libraries, or references that help others tackle development challenges.\n';
  context += '9. miscellaneous-technical-contribution - Awarded for any other notable technical input not covered by the above categories.\n\n';

  // Product Category
  context += 'PRODUCT CATEGORY:\n';
  context += '1. provided-product-feedback - Awarded for sharing insights or constructive criticism on product features or user experience.\n';
  context += '2. suggested-feature - Awarded for proposing a new functionality or improvement that could enhance the product.\n';
  context += '3. identified-a-problem - Awarded for spotting a user-facing issue, bug, or design flaw that needs attention.\n';
  context += '4. identified-an-opportunity - Awarded for highlighting a new angle or market gap the product could address.\n';
  context += '5. shared-user-experience - Awarded for posting personal usage insights or case studies that shed light on product strengths/weaknesses.\n';
  context += '6. miscellaneous-product-contribution - Awarded for any other notable product-related input not covered by the above categories.\n\n';

  // Community & Support Category
  context += 'COMMUNITY & SUPPORT CATEGORY:\n';
  context += '1. introduced-themselves - Awarded when a new member gives a helpful or detailed introduction, letting others get to know them.\n';
  context += '2. welcomed-new-member - Awarded for greeting and helping integrate someone who has just joined the community.\n';
  context += '3. onboarded-new-member - Awarded for guiding a newcomer step by step, ensuring they have everything needed to participate.\n';
  context += '4. signposted-user - Awarded for directing someone to the right channel, FAQ, or documentation to answer their query.\n';
  context += '5. helped-another-user - Awarded for assisting with a non-technical concern, solving a user\'s question or problem.\n';
  context += '6. asked-quality-question - Awarded for posing an insightful question that stimulates valuable discussion (not strictly technical).\n';
  context += '7. provided-advice - Awarded for sharing helpful suggestions or tips when responding to someone\'s query.\n';
  context += '8. offered-guidance - Awarded for offering deeper or more strategic input that helps others navigate challenges.\n';
  context += '9. shared-community-update - Awarded for posting relevant announcements, recap summaries, or general news about the community.\n';
  context += '10. initiated-a-conversation - Awarded for starting a constructive thread or topic that brings value or sparks discussion.\n';
  context += '11. boosted-morale - Awarded for uplifting, encouraging, or thanking community members in a meaningful way.\n';
  context += '12. identified-spammer - Awarded for alerting moderators or the community about suspicious or spammy behavior before it causes issues.\n';
  context += '13. miscellaneous-community-contribution - Awarded for any other notable community or support input not covered by the above categories.\n\n';

  // Growth Category
  context += 'GROWTH CATEGORY:\n';
  context += '1. shared-meme - Awarded for posting a relevant or engaging meme that boosts community spirit or brand awareness.\n';
  context += '2. identified-partnership-opportunity - Awarded for highlighting a potential collaboration with another project or community that benefits everyone.\n';
  context += '3. shared-success-story - Awarded for showcasing a personal or community-wide win that could inspire or attract new interest.\n';
  context += '4. proposed-growth-initiative - Awarded for suggesting a concrete marketing, referral, or growth plan to expand the project\'s reach.\n';
  context += '5. miscellaneous-growth-contribution - Awarded for any other notable growth-related input not covered by the above categories.\n\n';

  // Instructions
  context += 'IMPORTANT INSTRUCTIONS:\n';
  context += '- ALWAYS use one of these exact reward IDs when identifying contributions\n';
  context += '- Choose the most appropriate category and specific reward ID that matches the contribution\n';
  context += '- Do not create new reward IDs or modify existing ones\n';
  context += '- If a contribution doesn\'t clearly fit any category, use the most relevant one or the miscellaneous option in that category\n';
  context += '- The reward ID should be descriptive but concise, using kebab-case format\n';
  context += '- The reward ID should be under 32 characters\n';
  context += '- The reward ID should be in kebab-case\n';

  return context;
} 