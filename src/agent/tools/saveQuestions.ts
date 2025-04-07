import { createTool } from "@mastra/core";
import { z } from "zod";
import { db } from "@/db";
import { communityQuestions } from "@/db/schema";

export const saveQuestionsTool = createTool({
  id: "save-questions",
  description: "Save community questions to the database",
  inputSchema: z.object({
    questions: z.array(z.string()),
    startDate: z.number(),
    endDate: z.number(),
    platformId: z.string(),
    communityId: z.string(),
    isAsked: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    questionsIds: z.array(z.string().uuid()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Convert timestamps to Date objects
      const startDate = new Date(context.startDate);
      const endDate = new Date(context.endDate);

      // Insert each question as a separate record
      const savedQuestions = [];
      for (const question of context.questions) {
        const [saved] = await db.insert(communityQuestions).values({
          community_id: context.communityId,
          platform_id: context.platformId,
          questions: question,
          start_date: startDate,
          end_date: endDate,
          is_asked: context.isAsked || false,
        }).returning();
        
        savedQuestions.push(saved);
      }

      return {
        success: true,
        questionsIds: savedQuestions.map(q => q.id),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Exception saving questions:", error.message);
      } else {
        console.error("Exception saving questions:", error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
}); 