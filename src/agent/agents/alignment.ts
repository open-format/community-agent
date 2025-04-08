import { Agent } from '@mastra/core/agent';
import { google } from "@ai-sdk/google";
import { db } from '@/db';
import { 
  communities, 
  teamMembers, 
  tokenDetails, 
  goodExampleRewards, 
  badExampleRewards,
  communityQuestions,
  communityProjects,
  communityEvents
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  updateCommunityInfoTool,
  addTeamMemberTool,
  removeTeamMemberTool,
  updateTokenTool,
  removeTokenTool,
  addGoodExampleRewardTool,
  addBadExampleRewardTool,
  removeGoodExampleRewardTool,
  removeBadExampleRewardTool,
  markQuestionsAsAskedTool,
  updateCommunityProjectTool,
  removeCommunityProjectTool,
  updateProjectProgressTool,
  updateCommunityEventTool,
  removeCommunityEventTool,
  updateEventStatusTool
} from '../tools/community_manager_tools';
import { Memory } from "@mastra/memory";
import dayjs from "dayjs";

// Database schema information to help the agent understand data structures
const DATABASE_SCHEMA = `
## COMMUNITIES TABLE
The communities table stores basic information about each community:
- id (text, primary key): Unique identifier for the community
- name (text): Name of the community
- description (text): Description of the community
- roles (jsonb): Array of roles in the community
- goals (jsonb): Array of community goals
- platforms (jsonb): Array of platforms the community uses
- type (text): Type of community
- stage (text): Current stage of the community
- createdAt (timestamp): When the community was created
- updatedAt (timestamp): When the community was last updated
- communityWalletId (text): ID of the community wallet
- communityWalletAddress (text): Address of the community wallet

## TEAM MEMBERS TABLE
The team_members table stores information about team members:
- id (uuid, primary key): Unique identifier for the team member
- community_id (text): ID of the community this team member belongs to
- discord_name (text): Discord username of the team member
- role (text): Role of the team member in the community
- should_be_rewarded (boolean): Whether this team member should receive rewards
- created_at (timestamp): When the team member was added
- updated_at (timestamp): When the team member was last updated

## TOKEN DETAILS TABLE
The token_details table stores information about tokens used for rewards:
- id (uuid, primary key): Unique identifier for the token detail
- community_id (text): ID of the community this token belongs to
- token_address (text): Blockchain address of the token
- token_name (text): Name of the token
- reward_condition (text): When to use this token for rewards
- major_contribution_amount (integer): Amount to reward for major contributions
- minor_contribution_amount (integer): Amount to reward for minor contributions
- additional_context (text): Additional information about the token
- created_at (timestamp): When the token detail was created
- updated_at (timestamp): When the token detail was last updated

## GOOD EXAMPLE REWARDS TABLE
The good_example_rewards table stores examples of good contributions:
- id (uuid, primary key): Unique identifier for the example
- community_id (text): ID of the community this example belongs to
- contributor (text): Username of the contributor
- short_summary (text): Brief summary of the contribution
- comprehensive_description (text): Detailed description of the contribution
- impact (text): Impact of the contribution on the community
- evidence (text[]): Array of evidence supporting the contribution
- reward_id (text): ID of the reward type
- suggested_reward (jsonb): Object containing points, reasoning, and tokenAddress
- created_at (timestamp): When the example was created
- updated_at (timestamp): When the example was last updated

## BAD EXAMPLE REWARDS TABLE
The bad_example_rewards table stores examples of contributions that should not be rewarded:
- id (uuid, primary key): Unique identifier for the example
- community_id (text): ID of the community this example belongs to
- contributor (text): Username of the contributor
- short_summary (text): Brief summary of the contribution
- evidence (text[]): Array of evidence supporting the contribution
- why_not_reward (text): Explanation of why this contribution should not be rewarded
- created_at (timestamp): When the example was created
- updated_at (timestamp): When the example was last updated

## COMMUNITY PROJECTS TABLE
The community_projects table stores information about projects, features, and products within the community:
- id (uuid, primary key): Unique identifier for the project
- community_id (text): ID of the community this project belongs to
- name (text): Name of the project/feature/product
- description (text): Description of what the project does and why it matters
- type (text): Type of the item (project, product, or feature)
- status (text): Current status of the project (planning, in_development, beta_testing, launched, deprecated)
- key_contributors (jsonb): Array of discord names of people actively building or maintaining the feature
- current_progress (text): Current status or progress of the project
- related_resources (jsonb): Array of links to documentation, repositories, or other relevant resources
- created_at (timestamp): When the project was created
- updated_at (timestamp): When the project was last updated

## COMMUNITY EVENTS TABLE
The community_events table stores information about community events:
- id (uuid, primary key): Unique identifier for the event
- community_id (text): ID of the community this event belongs to
- name (text): Name of the event
- description (text): Description of the event
- regularity (text): How often the event occurs (one-time, weekly, monthly, etc.)
- schedule (text): When the event occurs (e.g., "Every Wednesday at 7-8pm UK time")
- rewards_description (text): Description of when and how users should be rewarded
- event_type (text): Type of event (meetup, ama, hackathon, quiz, office_hours, workshop, project_showcase, community_call, partner_announcement, other)
- is_active (boolean): Whether the event is currently active
- created_at (timestamp): When the event was created
- updated_at (timestamp): When the event was last updated
`;

// Create a memory instance for storing conversation history
export const memory = new Memory({
  options: {
    lastMessages: 10, // Keep the last 10 messages in context
  },
});

/**
 * Alignment Agent
 * 
 * This agent is designed to assist community managers in updating data for context providers.
 * It helps them understand the current data structure and provides guidance on best practices.
 * 
 * The agent has access to:
 * 1. Current data from all context providers
 * 2. Detailed database schema information
 * 3. Tools to update the data
 * 
 * When a community manager asks a question, the agent will:
 * 1. Understand their needs
 * 2. Explain the data structure
 * 3. Help them formulate the correct data format
 * 4. Provide guidance on best practices
 * 
 * The agent can also analyze community messages to extract information and update context providers.
 */
export const alignmentAgent = new Agent({
  name: 'Alignment Agent',
  description: 'Assists community managers in updating data for context providers',
  model: google('gemini-2.0-flash-001'),
  tools: {
    update_community_info: updateCommunityInfoTool,
    add_team_member: addTeamMemberTool,
    remove_team_member: removeTeamMemberTool,
    update_token: updateTokenTool,
    remove_token: removeTokenTool,
    add_good_example_reward: addGoodExampleRewardTool,
    add_bad_example_reward: addBadExampleRewardTool,
    remove_good_example_reward: removeGoodExampleRewardTool,
    remove_bad_example_reward: removeBadExampleRewardTool,
    mark_questions_asked: markQuestionsAsAskedTool,
    update_community_project: updateCommunityProjectTool,
    remove_community_project: removeCommunityProjectTool,
    update_project_progress: updateProjectProgressTool,
    update_community_event: updateCommunityEventTool,
    remove_community_event: removeCommunityEventTool,
    update_event_status: updateEventStatusTool,
  },
  memory, // Use the memory instance for conversation history
  instructions: `
    You are a helpful assistant for community managers. Your role is to help them have the best possible data in the context providers.
    
    You have access to the following context providers:
    1. Community Context - Basic information about the community
    2. Team Members Context - Information about team members
    3. Token Details Context - Information about tokens
    4. Good Example Rewards Context - Examples of good contributions
    5. Bad Example Rewards Context - Examples of bad contributions
    6. Community Projects Context - Information about projects, features, and products within the community
    7. Community Events Context - Information about community events, meetups, AMAs, hackathons, etc.
    
    When helping community managers, you should:
    1. Understand their needs
    2. Help them update the data for the context providers
    3. Provide guidance on best practices
    
    For Community Projects, remember:
    - The "type" field should be one of: "project", "product", or "feature" (case insensitive)
    - The "status" field should be one of: "planning", "in_development", "beta_testing", "launched", or "deprecated" (case insensitive)
    Remember to always validate data before using the tools and provide clear feedback to community managers.
    
    ## IMPORTANT: CONVERSATIONAL STYLE
    - Be conversational and natural in your responses
    - NEVER mention the tools you're using by name
    - NEVER mention the database schema by name
    - NEVER mention that you have tools, just use them
    - NEVER ask for "exact text" or specific parameters in a mechanical way
    - Instead, have a natural conversation and gather information organically
    - If you need more information, ask in a conversational way
    - When confirming actions, be friendly and natural
    - Focus on the user's needs and goals, not the technical implementation
    - Use a warm, helpful tone throughout the conversation
    - Avoid technical jargon unless necessary
    - Make the interaction feel like talking to a helpful assistant, not a system
    
    ## HANDLING COMMUNITY QUESTIONS (CONVERSATIONAL MODE ONLY)
    - When in conversational mode with a community manager, ask questions from the unasked questions list
    - After asking a question, mark it as asked using the mark_questions_asked tool
    - Don't tell the user you are marking a question as asked, just do it
    - Choose questions that are relevant to the current conversation
    - Space out your questions naturally within the conversation
    - Don't ask too many questions at once - be conversational
    - Dont mention that you are asking a question from a list
    - You don't need to ask the question verbatim, just ask it in a conversational way
    - Feel free to ask follow up questions based on the answer
    
    ## CONTEXT UPDATE MODE
    When you're in context update mode (analyzing community messages), you should:
    - Focus on extracting factual information about the community from the messages
    - Your goal is to update the context providers with the most accurate and complete information about the community
    - Only update the context providers if you find clear information
    - Do not make assumptions or inferences without strong evidence
    - If you find information that contradicts existing data, update it
    - If you find new information not in the existing data, add it
    - If you don't find enough information to make a confident update, leave the existing data as is
    - If there is no existing context, that's even more reason to add information when you find it
    - DO NOT ask questions or mark questions as asked in context update mode
    - DO NOT engage in conversation with the community manager in context update mode
    - ONLY use the context update tools to update the database based on information found in messages
  `,
});

// Function to get unasked questions for a community
export async function getUnaskedQuestions(communityId: string) {
  try {
    // Query for unasked questions for the community, ordered by created_at in descending order
    const unaskedQuestions = await db.query.communityQuestions.findMany({
      where: (questions, { and, eq }) => 
        and(
          eq(questions.community_id, communityId),
          eq(questions.is_asked, false)
        ),
      orderBy: (questions, { desc }) => [desc(questions.created_at)],
    });
    
    return unaskedQuestions;
  } catch (error) {
    console.error(`[Alignment Agent] Error fetching unasked questions: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// Function to get current context data for a community
export async function getCurrentContextData(communityId: string) {
  
  try {
    // Directly query the database for raw data
    const communityData = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
    });
    
    const teamMembersData = await db.query.teamMembers.findMany({
      where: eq(teamMembers.community_id, communityId),
    });
    
    const tokenDetailsData = await db.query.tokenDetails.findMany({
      where: eq(tokenDetails.community_id, communityId),
    });
    
    const goodExampleRewardsData = await db.query.goodExampleRewards.findMany({
      where: eq(goodExampleRewards.community_id, communityId),
    });
    
    const badExampleRewardsData = await db.query.badExampleRewards.findMany({
      where: eq(badExampleRewards.community_id, communityId),
    });
    
    const communityProjectsData = await db.query.communityProjects.findMany({
      where: eq(communityProjects.community_id, communityId),
    });
    
    const communityEventsData = await db.query.communityEvents.findMany({
      where: eq(communityEvents.community_id, communityId),
    });
    
    // Get unasked questions
    const unaskedQuestionsData = await getUnaskedQuestions(communityId);

    // Format the data as JSON strings
    const formatData = (data: any) => {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return "No data available for this category.";
      }
      try {
        return JSON.stringify(data, null, 2);
      } catch (e) {
        console.error(`[Alignment Agent] Error formatting data: ${e}`);
        return "Error formatting data.";
      }
    };

    return {
      communityContext: formatData(communityData),
      teamContext: formatData(teamMembersData),
      tokenContext: formatData(tokenDetailsData),
      exampleRewardsContext: formatData({
        goodExamples: goodExampleRewardsData,
        badExamples: badExampleRewardsData
      }),
      communityProjectsContext: formatData(communityProjectsData),
      communityEventsContext: formatData(communityEventsData),
      unaskedQuestionsContext: formatData(unaskedQuestionsData),
    };
  } catch (error) {
    console.error(`[Alignment Agent] Error fetching context data: ${error instanceof Error ? error.message : String(error)}`);
    return {
      communityContext: "Error retrieving community data.",
      teamContext: "Error retrieving team member data.",
      tokenContext: "Error retrieving token data.",
      exampleRewardsContext: "Error retrieving example rewards data.",
      communityProjectsContext: "Error retrieving community projects data.",
      communityEventsContext: "Error retrieving community events data.",
      unaskedQuestionsContext: "Error retrieving unasked questions data.",
    };
  }
}

// Function to generate a prompt with current context data
export async function generateContextPrompt(communityId: string, userQuery: string) {
  
  const contextData = await getCurrentContextData(communityId);
  
  // Create a single, flexible prompt that can handle all scenarios
  const prompt = `You are helping a community manager update the data used by the rewards system for community ID: ${communityId}.

Here is the current data for each context provider:

### COMMUNITY INFORMATION
${contextData.communityContext}

### TEAM MEMBER DETAILS
${contextData.teamContext}

### TOKEN DETAILS
${contextData.tokenContext}

### EXAMPLE REWARDS
${contextData.exampleRewardsContext}

### COMMUNITY PROJECTS
${contextData.communityProjectsContext}

### COMMUNITY EVENTS
${contextData.communityEventsContext}

### UNASKED QUESTIONS
${contextData.unaskedQuestionsContext}

## DATABASE SCHEMA
${DATABASE_SCHEMA}

## YOUR TASK
Your task is to help the community manager update the context providers with accurate and complete information. You should:

1. If the context is empty or incomplete, ask questions to gather the necessary information
2. If the user provides information, evaluate it and then update the context providers
3. Guide the user on what information is needed
4. When appropriate, ask questions from the unasked questions list
5. After asking a question, mark it as asked using the mark_questions_asked tool

## SPECIFIC GUIDANCE
- For empty community information, ask about the community's goals, type, stage, and platforms
- For empty team information, ask about team members, their roles, and whether they should be rewarded
- For empty token information, ask about tokens used for rewards, their addresses, and reward conditions
- For empty example rewards, ask for examples of good and bad contributions
- For empty community projects, ask about projects, features, and products within the community, their type (project, product, or feature), status, and key contributors
- For empty community events, ask about events, meetups, AMAs, hackathons, quiz nights, office hours, etc., their regularity, schedule, and reward conditions
- When appropriate, ask questions from the unasked questions list to gather more information about the community

## AVAILABLE TOOLS
You have access to the following tools to update the database:

1. update_community_info - Update community information
2. add_team_member - Add a new team member or update an existing one
3. remove_team_member - Remove a team member
4. update_token - Add a new token or update an existing one
5. remove_token - Remove a token
6. add_good_example_reward - Add a good example reward
7. add_bad_example_reward - Add a bad example reward
8. remove_good_example_reward - Remove a good example reward
9. remove_bad_example_reward - Remove a bad example reward
10. mark_questions_asked - Mark a question as asked
11. update_community_project - Add a new community project or update an existing one
12. remove_community_project - Remove a project from the database
13. update_project_progress - Update the progress of a community project
14. update_community_event - Add a new community event or update an existing one
15. remove_community_event - Remove an event from the database
16. update_event_status - Update the active status of a community event

Use these tools when appropriate to update the database based on the information provided by the community manager.

## IMPORTANT INSTRUCTIONS
- If the user asks to remove a goal, you MUST use the update_community_info tool to update the goals array
- If the user asks to add a goal, you MUST use the update_community_info tool to update the goals array
- If the user asks to modify any data, you MUST use the appropriate tool to update the database
- Always provide a clear response explaining what you did or what you need from the user
- When you ask a question from the unasked questions list, you MUST mark it as asked using the mark_questions_asked tool
- Choose questions that are relevant to the current conversation and space them out naturally

The community manager has asked: "${userQuery}"

Please respond in a helpful, conversational manner. If they've provided information, evaluate it and then go and update the context providers. If they haven't provided specific information, ask questions to gather the necessary data. Always guide them toward providing complete, accurate information that will be useful for the rewards system.`;

  
  // Process the query with the agent
  const response = await alignmentAgent.generate(prompt, {
    resourceId: communityId, // Use communityId as the resourceId
    threadId: `alignment_${communityId}`, // Create a unique threadId for this community
    maxSteps: 3, // Increase the number of tool usage steps to allow for more complex operations
    onStepFinish: ({text, toolCalls, toolResults}: {text: string, toolCalls: any, toolResults: any}) => {
      console.log("Step completed", {text, toolCalls, toolResults});
    },
    onFinish: ({
      steps,
      text,
      finishReason, // 'complete', 'length', 'tool', etc.
      usage, // token usage statistics
      reasoningDetails, // additional context about the agent's decisions
    }: {
      steps: any[];
      text: string;
      finishReason: string;
      usage: any;
      reasoningDetails: any;
    }) => {
      console.log("Stream complete:", {
        totalSteps: steps.length,
        finishReason,
        usage,
      });
    }
  });

  
  return response.text;
}

// Function to generate a prompt for context update based on community messages
export async function generateContextUpdatePrompt(
  communityId: string, 
  transcript: string, 
  stats: any, 
  startDate: number, 
  endDate: number
) {
  const contextData = await getCurrentContextData(communityId);
  
  // Create a prompt for the alignment agent to analyze the transcript and update context providers
  const prompt = `You are an AI assistant tasked with analyzing community messages and updating the context providers for community ID: ${communityId}.

## CURRENT CONTEXT DATA
Here is the current data for each context provider:

### COMMUNITY INFORMATION
${contextData.communityContext}

### TEAM MEMBER DETAILS
${contextData.teamContext}

### TOKEN DETAILS
${contextData.tokenContext}

### EXAMPLE REWARDS
${contextData.exampleRewardsContext}

### COMMUNITY PROJECTS
${contextData.communityProjectsContext}

### COMMUNITY EVENTS
${contextData.communityEventsContext}

### Database Schema
${DATABASE_SCHEMA}

## COMMUNITY MESSAGES
Below is a transcript of community messages from ${dayjs(startDate).format('YYYY-MM-DD')} to ${dayjs(endDate).format('YYYY-MM-DD')}:

${transcript}

## MESSAGE STATISTICS
${JSON.stringify(stats, null, 2)}

## YOUR TASK
Your task is to analyze these messages and update the context providers with any relevant information you can extract. Focus on:

1. Community Information: 
- Identify the communities name and a short description of what the community seems to do. Use the whole transcript to identify this, it may require some inference.
- Identify any goals the community seems to have
- Identify the type of community it seems to be
- Identify the stage the community is at e.g. just starting, growing, stable, declining, etc.


2. Team Members: 
- Identify any discord members who seem to be team members and are working on projects in the community
- Identify what their roles seem to be
- Identify whether they should be rewarded

3. Token Details: 
- Identify any tokens that the community seems to have
- If it is shared directly than identify this tokens addresses 
- Only if directly mentioned than identify the situations in which this token should be used for rewards

4. Example Rewards: 
- Identify examples of good contributions within the community, times where someone has commented on how useful a contribution was
- Identify examples of contributions that were not at all useful, spammy, offensive, or otherwise not useful to the community

5. Community Projects: 
- Identify projects, features, and products that seem to be actively happening within the community.
- Give a short description of what the project/feature/product involves or is about
- Identify the type i.e. whether it is a project, feature, or product, you should be able to identify this from the context of the messages.
- If features fit within a product and project then both the features and project/product should be included
- Identify the projects status, you may have to infer this from the context of any messages about the project/feature/product
- Identify the key contributors to the project/feature/product, the discord names of anyone who has discussed of being mentioned in reference to the project/feature/product
- Identify the current progress of the project/feature/product, use the most recent messages about the project/feature/product to infer this
- Identify links to any related resources, such as documentation, repositories, or other relevant links. These will most likely be found in the messages about the project/feature/product. If in doubt, include the link. Include all links found in the messages.

6. Community Events:
- Identify any events, meetups, AMAs, hackathons, quiz nights, office hours, etc. that are mentioned in the messages
- Give a short description of what the event involves or is about
- Identify the type of event (meetup, ama, hackathon, quiz, office_hours, workshop, project_showcase, community_call, partner_announcement, or other)
- Identify the regularity of the event (one-time, weekly, monthly, etc.)
- Identify the schedule of the event (e.g., "Every Wednesday at 7-8pm UK time")
- Identify any reward conditions for participating in the event

## IMPORTANT FORMATTING GUIDELINES
- For Community Projects, the "type" field should be one of: "project", "product", or "feature" (case insensitive)
- For Community Projects, the "status" field should be one of: "planning", "in_development", "beta_testing", "launched", or "deprecated" (case insensitive)
- For Community Events, the "event_type" field should be one of: "meetup", "ama", "hackathon", "quiz", "office_hours", "workshop", "project_showcase", "community_call", "partner_announcement", or "other"
- Always use lowercase for these enum values to ensure compatibility

## IMPORTANT INSTRUCTIONS
- Only update the context providers if you find clear, explicit information in the messages
- Do not make assumptions or inferences without strong evidence
- If you find information that contradicts existing data, update it
- If you find new information not in the existing data, add it
- If you don't find enough information to make a confident update, leave the existing data as is
- If the current context is empty, that's even more reason to add information when you find it
- Focus on factual information rather than opinions or subjective assessments
- DO NOT ask questions or mark questions as asked in this mode
- DO NOT engage in conversation with the community manager in this mode
- ONLY use the context update tools to update the database based on information found in messages

## CRITICAL: USING TOOLS IN CONTEXT UPDATE MODE
You MUST use the appropriate tools to update the context providers:
- For community information updates, use the update_community_info tool
- For team member updates, use the add_team_member or remove_team_member tools
- For token updates, use the update_token or remove_token tools
- For example rewards, use the add_good_example_reward, add_bad_example_reward, remove_good_example_reward, or remove_bad_example_reward tools
- For community projects, use the update_community_project, remove_community_project, or update_project_progress tools
- For community events, use the update_community_event, remove_community_event, or update_event_status tools

Please analyze the messages and update the context providers as needed.`;

  // Process the query with the agent
  const response = await alignmentAgent.generate(prompt, {
    resourceId: communityId,
    threadId: `context_update_${communityId}_${Date.now()}`,
    maxSteps: 30, // Allow more steps for complex updates
  });
  
  return response.text;
} 