import type { MiddlewareHandler } from "hono";

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Handle webhook paths
    if (c.req.path.startsWith("/api/v1/webhooks")) {
      // Webhooks don't need auth or community ID
      return next();
    }

    // For non-webhook paths, manually check bearer token without calling next()
    const token = process.env.API_KEY as string;
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== token) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    // If auth passes, check community ID
    const communityId = c.req.header("X-Community-ID");
    if (!communityId) {
      return c.json({ error: "X-Community-ID header is required" }, 400);
    }

    // Set community ID and call next once
    c.set("communityId", communityId);
    return next();
  };
}
