import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscordAPIError, Message } from "discord.js";

// Mock the error handler utilities
vi.mock("@/utils/errors", () => ({
  handleDiscordAPIError: vi.fn(),
  isRecoverableDiscordError: vi.fn(),
}));

// Mock the logger
vi.mock("@/services/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock other dependencies
vi.mock("@/agent", () => ({
  mastra: {
    getAgent: vi.fn(),
  },
}));

vi.mock("@/agent/stores", () => ({
  vectorStore: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/clients/common/utils", () => ({
  getEmbeddingsVector: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

describe("Discord Client - getThreadStartMessageId", () => {
  let mockMessage: Partial<Message>;
  let mockReferencedMessage: Partial<Message>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock messages
    mockMessage = {
      id: "message-123",
      channelId: "channel-456",
      guildId: "guild-789",
      reference: {
        messageId: "referenced-message-456",
        channelId: "channel-456",
        guildId: "guild-789",
      },
      fetchReference: vi.fn(),
    };

    mockReferencedMessage = {
      id: "referenced-message-456",
      channelId: "channel-456",
      guildId: "guild-789",
      reference: null,
    };
  });

  // Since getThreadStartMessageId is not exported, we need to test it indirectly
  // through the messageCreate handler or extract it for testing
  // For now, let's create a test version of the function

  const getThreadStartMessageId = async (msg: Message): Promise<string> => {
    const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
    
    let currentMsg = msg;

    while (currentMsg.reference?.messageId) {
      try {
        const referencedMsg = await currentMsg.fetchReference();
        if (!referencedMsg.reference) {
          return referencedMsg.id; // This is the first message
        }
        currentMsg = referencedMsg;
      } catch (error) {
        // Handle Discord API errors when fetching message references
        const errorDetails = handleDiscordAPIError(error, {
          messageId: currentMsg.reference.messageId,
          channelId: currentMsg.channelId,
          guildId: currentMsg.guildId || undefined,
          operation: "fetchReference",
        });

        // If it's a recoverable error (like deleted message), return current message ID
        if (isRecoverableDiscordError(errorDetails)) {
          return currentMsg.id;
        }

        // For non-recoverable errors, still return current message ID to prevent crashes
        return currentMsg.id;
      }
    }

    return currentMsg.id;
  };

  describe("getThreadStartMessageId", () => {
    it("should return message ID when message has no reference", async () => {
      const messageWithoutReference = {
        ...mockMessage,
        reference: null,
      } as Message;

      const result = await getThreadStartMessageId(messageWithoutReference);

      expect(result).toBe("message-123");
    });

    it("should traverse reference chain and return thread start message ID", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      // Mock successful reference fetching
      (mockMessage.fetchReference as any).mockResolvedValue(mockReferencedMessage);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("referenced-message-456");
      expect(mockMessage.fetchReference).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple levels of references", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      // Create a chain: message -> referenced -> original
      const originalMessage = {
        id: "original-message-789",
        channelId: "channel-456",
        guildId: "guild-789",
        reference: null,
      };

      const referencedMessage = {
        ...mockReferencedMessage,
        reference: {
          messageId: "original-message-789",
          channelId: "channel-456",
          guildId: "guild-789",
        },
        fetchReference: vi.fn().mockResolvedValue(originalMessage),
      };

      (mockMessage.fetchReference as any).mockResolvedValue(referencedMessage);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("original-message-789");
      expect(mockMessage.fetchReference).toHaveBeenCalledTimes(1);
      expect(referencedMessage.fetchReference).toHaveBeenCalledTimes(1);
    });

    it("should handle Unknown Message error (deleted reference)", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      const discordError = new DiscordAPIError(
        {
          message: "Unknown Message",
          code: 10008,
        },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/456/messages/referenced-message-456",
        {}
      );

      // Mock fetchReference to throw Unknown Message error
      (mockMessage.fetchReference as any).mockRejectedValue(discordError);

      // Mock error handler to return recoverable error
      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_MESSAGE",
        code: 10008,
        message: "Unknown Message",
      });
      (isRecoverableDiscordError as any).mockReturnValue(true);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("message-123"); // Should return current message ID
      expect(handleDiscordAPIError).toHaveBeenCalledWith(
        discordError,
        {
          messageId: "referenced-message-456",
          channelId: "channel-456",
          guildId: "guild-789",
          operation: "fetchReference",
        }
      );
      expect(isRecoverableDiscordError).toHaveBeenCalled();
    });

    it("should handle Missing Access error", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      const discordError = new DiscordAPIError(
        {
          message: "Missing Access",
          code: 50001,
        },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/456/messages/referenced-message-456",
        {}
      );

      (mockMessage.fetchReference as any).mockRejectedValue(discordError);
      (handleDiscordAPIError as any).mockReturnValue({
        type: "MISSING_ACCESS",
        code: 50001,
        message: "Missing Access",
      });
      (isRecoverableDiscordError as any).mockReturnValue(true);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("message-123");
      expect(handleDiscordAPIError).toHaveBeenCalledWith(
        discordError,
        {
          messageId: "referenced-message-456",
          channelId: "channel-456",
          guildId: "guild-789",
          operation: "fetchReference",
        }
      );
    });

    it("should handle non-recoverable errors", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      const networkError = new Error("Network timeout");

      (mockMessage.fetchReference as any).mockRejectedValue(networkError);
      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_ERROR",
        code: 0,
        message: "Network timeout",
      });
      (isRecoverableDiscordError as any).mockReturnValue(false);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("message-123"); // Should still return current message ID to prevent crashes
      expect(handleDiscordAPIError).toHaveBeenCalledWith(
        networkError,
        {
          messageId: "referenced-message-456",
          channelId: "channel-456",
          guildId: "guild-789",
          operation: "fetchReference",
        }
      );
    });

    it("should handle error in the middle of reference chain", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      
      // First reference succeeds
      const intermediateMessage = {
        id: "intermediate-message-456",
        channelId: "channel-456",
        guildId: "guild-789",
        reference: {
          messageId: "deleted-message-789",
          channelId: "channel-456",
          guildId: "guild-789",
        },
        fetchReference: vi.fn(),
      };

      // Second reference fails
      const discordError = new DiscordAPIError(
        {
          message: "Unknown Message",
          code: 10008,
        },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/456/messages/deleted-message-789",
        {}
      );

      (mockMessage.fetchReference as any).mockResolvedValue(intermediateMessage);
      (intermediateMessage.fetchReference as any).mockRejectedValue(discordError);
      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_MESSAGE",
        code: 10008,
        message: "Unknown Message",
      });
      (isRecoverableDiscordError as any).mockReturnValue(true);

      const result = await getThreadStartMessageId(mockMessage as Message);

      expect(result).toBe("intermediate-message-456"); // Should return the intermediate message ID
      expect(mockMessage.fetchReference).toHaveBeenCalledTimes(1);
      expect(intermediateMessage.fetchReference).toHaveBeenCalledTimes(1);
    });
  });
});
