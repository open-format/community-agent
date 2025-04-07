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