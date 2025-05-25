import { createRoute, z } from "@hono/zod-openapi";
import { user, userUpdate } from "./schema";

export const getUser = createRoute({
  method: "get",
  path: "/:did",
  description: "Retrieves user details by DID",
  request: {
    params: z.object({
      did: z.string(),
    }),
  },
  responses: {
    200: {
      description: "The user was retrieved successfully",
      content: {
        "application/json": {
          schema: user,
        },
      },
    },
    403: {
      description: "You dont have permissions to get user",
    },
    404: {
      description: "User not found",
    },
  },
});

export const createUser = createRoute({
  method: "post",
  path: "/",
  description: "Create user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: user,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The user was created successfully",
      content: {
        "application/json": {
          schema: user,
        },
      },
    },
    201: {
      description: "The user was created successfully",
      content: {
        "application/json": {
          schema: user,
        },
      },
    },
    400: {
      description: "Bad request",
    },
    409: {
      description: "User already exists",
    },
    500: {
      description: "Failed to create user",
    },
  },
});

export const updateUser = createRoute({
  method: "put",
  path: "/:did",
  description: "Update user by did",
  request: {
    body: {
      content: {
        "application/json": {
          schema: userUpdate,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The user was created successfully",
      content: {
        "application/json": {
          schema: userUpdate,
        },
      },
    },
    400: {
      description: "Bad request",
    },
    403: {
      description: "You dont have permissions to update user",
    },
    404: {
      description: "User was not found",
    },
    500: {
      description: "Failed to update user",
    },
  },
});

export const deleteUser = createRoute({
  method: "delete",
  path: "/:did",
  description: "Delete an user by did",
  request: {
    params: z.object({
      did: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: "User deleted successfully",
    },
    400: {
      description: "Bad request",
    },
    403: {
      description: "You dont have permissions to update user",
    },
    404: {
      description: "User was not found",
    },
    500: {
      description: "Failed to delete user",
    },
  },
});

export const assignRole = createRoute({
  method: "post",
  path: "/assign-role",
  description: "Assign a role to a user in a community",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            did: z.string(),
            community_id: z.string().uuid(),
            role_name: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Role assigned successfully",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().uuid(),
            userCommunityId: z.string().uuid(),
            roleId: z.string().uuid(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          }),
        },
      },
    },
    400: {
      description: "Bad request or user/role not found",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});
