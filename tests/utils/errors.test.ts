import { DiscordAPIError } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DiscordErrorDetails,
  handleDiscordAPIError,
  isRecoverableDiscordError,
} from "../../src/utils/errors";

// Simple mock - no complex dynamic imports
vi.mock("@/services/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Discord API Error Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleDiscordAPIError", () => {
    it("should handle Missing Access error (code 50001)", () => {
      const discordError = new DiscordAPIError(
        { message: "Missing Access", code: 50001 },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/123/messages",
        {},
      );

      const result = handleDiscordAPIError(discordError, {
        channelId: "123456789",
        operation: "fetchMessages",
      });

      expect(result).toEqual({
        type: "MISSING_ACCESS",
        code: 50001,
        message: "Missing Access",
        context: { channelId: "123456789", operation: "fetchMessages" },
        originalError: discordError,
      });
    });

    it("should handle Unknown Message error (code 10008)", () => {
      const discordError = new DiscordAPIError(
        { message: "Unknown Message", code: 10008 },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/123/messages/456",
        {},
      );

      const result = handleDiscordAPIError(discordError, {
        messageId: "456789123",
        operation: "fetchReference",
      });

      expect(result.type).toBe("UNKNOWN_MESSAGE");
      expect(result.code).toBe(10008);
    });

    it("should handle Rate Limited error (code 429)", () => {
      const discordError = new DiscordAPIError(
        { message: "Too Many Requests", code: 429 },
        429,
        429,
        "GET",
        "https://discord.com/api/v10/channels/123/messages",
        {},
      );

      const result = handleDiscordAPIError(discordError);

      expect(result.type).toBe("RATE_LIMITED");
      expect(result.code).toBe(429);
    });

    it("should handle non-Discord API errors", () => {
      const networkError = new Error("Network timeout");

      const result = handleDiscordAPIError(networkError, {
        operation: "fetchMessages",
      });

      expect(result.type).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("Network timeout");
    });
  });

  describe("isRecoverableDiscordError", () => {
    it("should identify recoverable errors", () => {
      const recoverableErrors: DiscordErrorDetails[] = [
        { type: "MISSING_ACCESS", code: 50001, message: "Missing Access" },
        { type: "UNKNOWN_MESSAGE", code: 10008, message: "Unknown Message" },
      ];

      recoverableErrors.forEach((error) => {
        expect(isRecoverableDiscordError(error)).toBe(true);
      });
    });

    it("should identify non-recoverable errors", () => {
      const nonRecoverableErrors: DiscordErrorDetails[] = [
        { type: "RATE_LIMITED", code: 429, message: "Too Many Requests" },
        { type: "UNKNOWN_ERROR", code: 0, message: "Some error" },
      ];

      nonRecoverableErrors.forEach((error) => {
        expect(isRecoverableDiscordError(error)).toBe(false);
      });
    });
  });
});
