import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";

// Define the schema for structured output
const questionsOutputSchema = z.object({
  questions: z.array(z.string())
});

export const questionsAgent = new Agent({
  name: "community-questions-generator",
  instructions: `You are a community analyst that generates insightful questions to gather more details about a community.
  
  When analyzing community discussions, focus on:
  1. Key topics and themes that need more exploration
  2. Periods of high activity or engagement that could be investigated further
  3. Potential areas of improvement or growth for the community
  4. Unclear aspects of community goals or values that need clarification
  5. Opportunities for deeper understanding of community dynamics
  
  Generate 5-10 thoughtful, open-ended questions that will help gather more details about the community.
  Questions should be conversational, specific, and designed to elicit detailed responses.
  Avoid yes/no questions and focus on questions that encourage reflection and sharing.
  
  IMPORTANT: You must output your questions as a JSON array of strings, with each question as a separate string in the array.`
  ,
  model: google("gemini-2.0-flash-001"),
});

// Function to generate questions using the agent
export async function generateQuestions(transcript: string) {
  const prompt = `Analyze this conversation transcript and generate 5-10 thoughtful, open-ended questions that will help gather more details about this community. Focus on key topics, periods of activity, and areas that need more exploration.

IMPORTANT: You must output your questions as a JSON array of strings, with each question as a separate string in the array.

Chat transcript:
${transcript}`;

  const result = await questionsAgent.generate(prompt, {
    output: questionsOutputSchema
  });

  return {
    questions: result.object.questions
  };
} 