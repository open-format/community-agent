import { createRoute, z } from "@hono/zod-openapi";

export const postAlignmentChat = createRoute({
  method: "post",
  path: "/chat",
  tags: ["Alignment"],
  summary: "Chat with the alignment agent",
  description: "Send a message to the alignment agent and get a response",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    body: { 
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Chat response received successfully",
      content: {
        "application/json": {
          schema: z.object({
            response: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Bad request - missing community ID or message",
    },
    500: {
      description: "An error occurred while processing the chat request",
    },
  },
});

export const postGenerateQuestions = createRoute({
  method: "post",
  path: "/questions",
  tags: ["Alignment"],
  summary: "Generate community questions",
  description: "Starts the process of analyzing community messages to generate insightful questions",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    body: { 
      content: {
        "application/json": {
          schema: z.object({
            platform_id: z.string(),
            start_date: z
              .string()
              .datetime({ message: "must be a valid ISO 8601 date format" }),
            end_date: z
              .string()
              .datetime({ message: "must be a valid ISO 8601 date format" }),
            channel_id: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Questions generation started successfully",
      content: {
        "application/json": {
          schema: z.object({
            job_id: z.string().uuid(),
            status: z.enum(["pending", "processing", "completed", "failed"]),
            timeframe: z.object({
              start_date: z.string().datetime(),
              end_date: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: "Bad request - missing required parameters",
    },
    404: {
      description: "Community not found",
    },
    500: {
      description: "An error occurred while starting the questions generation",
    },
  },
});

export const getQuestionsStatus = createRoute({
  method: "get",
  path: "/questions/status/:job_id",
  tags: ["Alignment"],
  summary: "Check questions generation status",
  description: "Check the status of an ongoing questions generation request",
  request: {
    params: z.object({
      job_id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Questions generation status retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            job_id: z.string().uuid(),
            status: z.enum(["pending", "processing", "completed", "failed"]),
            questions: z.array(z.string()).optional(),
            timeframe: z.object({
              start_date: z.string().datetime(),
              end_date: z.string().datetime(),
            }),
            error: z.string().optional(),
          }),
        },
      },
    },
    404: {
      description: "Job not found",
    },
    500: {
      description: "An error occurred while checking the questions generation status",
    },
  },
}); 