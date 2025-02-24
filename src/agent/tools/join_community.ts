import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { communityMembers, users } from "../../db/schema";

export const joinCommunityTool = tool(
  async (input, config) => {
    try {
      const userId = config.configurable.metadata.userId;
      const communityId = config.configurable.metadata.community.id;

      switch (input.action.toLowerCase()) {
        case "create": {
          try {
            // First, check if user already exists
            const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

            let user;
            if (existingUser.length > 0) {
              // User exists, update their profile
              user = await db
                .update(users)
                .set({
                  nickname: input.nickname,
                  skills: input.skills,
                  interests: input.interests,
                })
                .where(eq(users.id, userId))
                .returning();
            } else {
              // User doesn't exist, create new user
              user = await db
                .insert(users)
                .values({
                  id: userId,
                  nickname: input.nickname,
                  skills: input.skills,
                  interests: input.interests,
                })
                .returning();
            }

            // Check if user is already a member of the community
            const existingMembership = await db
              .select()
              .from(communityMembers)
              .where(eq(communityMembers.userId, userId) && eq(communityMembers.communityId, communityId))
              .limit(1);

            if (existingMembership.length === 0) {
              // Add user to community members if not already a member
              await db.insert(communityMembers).values({
                userId,
                communityId,
                roles: ["member"],
              });
            }

            return JSON.stringify({
              user,
              message:
                existingUser.length > 0
                  ? "User profile updated and community membership confirmed"
                  : "User joined community successfully",
              status: "success",
            });
          } catch (error) {
            console.error("Error creating/updating user profile:", error);
            return JSON.stringify({
              error: "Failed to create or update user profile",
              status: "error",
            });
          }
        }

        case "update": {
          console.log("userProfileTool: update action");
          const user = await db
            .update(users)
            .set({
              nickname: input.nickname,
              skills: input.skills,
              interests: input.interests,
            })
            .where(eq(users.id, userId))
            .returning();

          return JSON.stringify({
            user,
            message: "User profile updated successfully",
            status: "success",
          });
        }

        case "get": {
          console.log("userProfileTool: get action");
          const user = await db.select().from(users).where(eq(users.id, userId));
          return JSON.stringify({
            user,
            message: "User profile retrieved successfully",
            status: "success",
          });
        }

        default:
          console.log("userProfileTool: default action");
          return JSON.stringify({
            error: "Invalid action",
            supportedActions: ["create", "update", "get"],
            status: "error",
          });
      }
    } catch (error) {
      console.error("Error joining community:", error);
      return JSON.stringify({
        error: "Failed to join community",
        status: "error",
      });
    }
  },
  {
    name: "join_community",
    description: "Join a community",
    schema: z.object({
      action: z.string().describe("Action to perform: 'create', 'update', 'get'"),
      nickname: z.string().describe("Contributor's preferred name or identifier"),
      skills: z
        .array(z.string())
        .describe("Professional skills and areas of expertise that can be used to contribute to the community"),
      interests: z.array(z.string()).describe("Areas of interest within the community"),
    }),
  }
);
