import { getThreadStartMessageId } from "@/utils/discord";
import { DiscordAPIError, type Message } from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Only mock external dependencies that are hard to test
vi.mock("@/services/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("Discord Client - getThreadStartMessageId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getThreadStartMessageId", () => {
    it("should return message ID when message has no reference", async () => {
      const message = {
        id: "message-123",
        reference: null,
        fetchReference: vi.fn(),
      } as unknown as Message;

      const result = await getThreadStartMessageId(message);

      expect(result).toBe("message-123");
    });

    it("should traverse reference chain to find thread start", async () => {
      const originalMessage = {
        id: "original-123",
        reference: null,
        fetchReference: vi.fn(),
      } as unknown as Message;

      const referencedMessage = {
        id: "referenced-456",
        reference: { messageId: "original-123", type: 0 },
        fetchReference: vi.fn().mockResolvedValue(originalMessage),
      } as unknown as Message;

      const message = {
        id: "message-789",
        reference: { messageId: "referenced-456", type: 0 },
        fetchReference: vi.fn().mockResolvedValue(referencedMessage),
      } as unknown as Message;

      const result = await getThreadStartMessageId(message);

      expect(result).toBe("original-123");
    });

    it("should handle Unknown Message error gracefully", async () => {
      const discordError = new DiscordAPIError(
        { message: "Unknown Message", code: 10008 },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/123/messages/456",
        {},
      );

      const message = {
        id: "message-123",
        reference: { messageId: "deleted-456", type: 0 },
        fetchReference: vi.fn().mockRejectedValue(discordError),
      } as unknown as Message;

      const result = await getThreadStartMessageId(message);

      expect(result).toBe("message-123");
    });

    it("should handle Missing Access error gracefully", async () => {
      const discordError = new DiscordAPIError(
        { message: "Missing Access", code: 50001 },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/123/messages/456",
        {},
      );

      const message = {
        id: "message-123",
        reference: { messageId: "no-access-456", type: 0 },
        fetchReference: vi.fn().mockRejectedValue(discordError),
      } as unknown as Message;

      const result = await getThreadStartMessageId(message);

      expect(result).toBe("message-123");
    });

    it("should handle non-recoverable errors gracefully", async () => {
      const networkError = new Error("Network timeout");

      const message = {
        id: "message-123",
        reference: { messageId: "network-error-456", type: 0 },
        fetchReference: vi.fn().mockRejectedValue(networkError),
      } as unknown as Message;

      const result = await getThreadStartMessageId(message);

      expect(result).toBe("message-123");
    });
  });
});
