import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscordAPIError } from "discord.js";
import {
  handleDiscordAPIError,
  isRecoverableDiscordError,
  type DiscordErrorDetails,
} from "../../src/utils/errors";

// Mock the logger
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
        {
          message: "Missing Access",
          code: 50001,
        },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/123/messages",
        {}
      );

      const context = {
        channelId: "123456789",
        messageId: "987654321",
        guildId: "111222333",
        operation: "fetchMessages",
      };

      const result = handleDiscordAPIError(discordError, context);

      expect(result).toEqual({
        type: "MISSING_ACCESS",
        code: 50001,
        message: "Missing Access",
        context,
        originalError: discordError,
      });
    });

    it("should handle Unknown Message error (code 10008)", () => {
      const discordError = new DiscordAPIError(
        {
          message: "Unknown Message",
          code: 10008,
        },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/123/messages/456",
        {}
      );

      const context = {
        messageId: "456789123",
        channelId: "123456789",
        operation: "fetchReference",
      };

      const result = handleDiscordAPIError(discordError, context);

      expect(result).toEqual({
        type: "UNKNOWN_MESSAGE",
        code: 10008,
        message: "Unknown Message",
        context,
        originalError: discordError,
      });
    });

    it("should handle Unknown Channel error (code 10003)", () => {
      const discordError = new DiscordAPIError(
        {
          message: "Unknown Channel",
          code: 10003,
        },
        10003,
        404,
        "GET",
        "https://discord.com/api/v10/channels/123",
        {}
      );

      const result = handleDiscordAPIError(discordError);

      expect(result.type).toBe("UNKNOWN_CHANNEL");
      expect(result.code).toBe(10003);
      expect(result.message).toBe("Unknown Channel");
    });

    it("should handle Rate Limited error (code 429)", () => {
      const discordError = new DiscordAPIError(
        {
          message: "Too Many Requests",
          code: 429,
        },
        429,
        429,
        "GET",
        "https://discord.com/api/v10/channels/123/messages",
        {}
      );

      const result = handleDiscordAPIError(discordError);

      expect(result.type).toBe("RATE_LIMITED");
      expect(result.code).toBe(429);
    });

    it("should handle unknown Discord API error codes", () => {
      const discordError = new DiscordAPIError(
        {
          message: "Some other error",
          code: 99999,
        },
        99999,
        500,
        "GET",
        "https://discord.com/api/v10/test",
        {}
      );

      const result = handleDiscordAPIError(discordError);

      expect(result.type).toBe("UNKNOWN_ERROR");
      expect(result.code).toBe(99999);
      expect(result.message).toBe("Some other error");
    });

    it("should handle non-Discord API errors", () => {
      const genericError = new Error("Network timeout");

      const context = {
        operation: "fetchMessages",
        channelId: "123456789",
      };

      const result = handleDiscordAPIError(genericError, context);

      expect(result).toEqual({
        type: "UNKNOWN_ERROR",
        code: 0,
        message: "Network timeout",
        context,
        originalError: genericError,
      });
    });

    it("should handle non-Error objects", () => {
      const unknownError = "String error";

      const result = handleDiscordAPIError(unknownError);

      expect(result.type).toBe("UNKNOWN_ERROR");
      expect(result.code).toBe(0);
      expect(result.message).toBe("Unknown error occurred");
      expect(result.originalError).toBe(unknownError);
    });

    it("should log Discord API errors with structured context", async () => {
      const { logger } = await import("@/services/logger");
      
      const discordError = new DiscordAPIError(
        {
          message: "Missing Access",
          code: 50001,
        },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/123/messages",
        {}
      );

      const context = {
        channelId: "123456789",
        operation: "fetchMessages",
      };

      handleDiscordAPIError(discordError, context);

      expect(logger.warn).toHaveBeenCalledWith(
        {
          discordError: {
            code: 50001,
            message: "Missing Access",
            method: "GET",
            url: "https://discord.com/api/v10/channels/123/messages",
            status: 403,
          },
          context,
        },
        "Discord API Error: Missing Access"
      );
    });

    it("should log non-Discord API errors", async () => {
      const { logger } = await import("@/services/logger");
      
      const genericError = new Error("Network error");
      const context = { operation: "test" };

      handleDiscordAPIError(genericError, context);

      expect(logger.error).toHaveBeenCalledWith(
        {
          error: "Network error",
          context,
        },
        "Non-Discord API error occurred"
      );
    });
  });

  describe("isRecoverableDiscordError", () => {
    it("should identify Missing Access as recoverable", () => {
      const errorDetails: DiscordErrorDetails = {
        type: "MISSING_ACCESS",
        code: 50001,
        message: "Missing Access",
      };

      expect(isRecoverableDiscordError(errorDetails)).toBe(true);
    });

    it("should identify Unknown Message as recoverable", () => {
      const errorDetails: DiscordErrorDetails = {
        type: "UNKNOWN_MESSAGE",
        code: 10008,
        message: "Unknown Message",
      };

      expect(isRecoverableDiscordError(errorDetails)).toBe(true);
    });

    it("should identify Unknown Channel as recoverable", () => {
      const errorDetails: DiscordErrorDetails = {
        type: "UNKNOWN_CHANNEL",
        code: 10003,
        message: "Unknown Channel",
      };

      expect(isRecoverableDiscordError(errorDetails)).toBe(true);
    });

    it("should identify Rate Limited as non-recoverable", () => {
      const errorDetails: DiscordErrorDetails = {
        type: "RATE_LIMITED",
        code: 429,
        message: "Too Many Requests",
      };

      expect(isRecoverableDiscordError(errorDetails)).toBe(false);
    });

    it("should identify Unknown Error as non-recoverable", () => {
      const errorDetails: DiscordErrorDetails = {
        type: "UNKNOWN_ERROR",
        code: 0,
        message: "Some unknown error",
      };

      expect(isRecoverableDiscordError(errorDetails)).toBe(false);
    });
  });
});
