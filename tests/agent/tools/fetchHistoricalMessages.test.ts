import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscordAPIError, Client, TextChannel, Guild, Message, Collection } from "discord.js";
import { fetchHistoricalMessagesTool } from "../../../src/agent/tools/fetchHistoricalMessages";

// Mock dependencies
vi.mock("@/utils/errors", () => ({
  handleDiscordAPIError: vi.fn(),
  isRecoverableDiscordError: vi.fn(),
}));

vi.mock("@/services/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/agent/stores", () => ({
  vectorStore: {
    query: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    embedding: vi.fn().mockReturnValue("mock-embedding-model"),
  },
}));

vi.mock("ai", () => ({
  embed: vi.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0.1),
  }),
}));

// Mock Discord.js Client
vi.mock("discord.js", async () => {
  const actual = await vi.importActual("discord.js");
  return {
    ...actual,
    Client: vi.fn(),
  };
});

describe("fetchHistoricalMessages Tool", () => {
  let mockClient: Partial<Client>;
  let mockGuild: Partial<Guild>;
  let mockChannel: Partial<TextChannel>;
  let mockMessage: Partial<Message>;
  let mockMessages: Collection<string, Message>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock message
    mockMessage = {
      id: "message-123",
      content: "Test message content",
      author: {
        id: "user-456",
        username: "testuser",
        bot: false,
      },
      channelId: "channel-789",
      createdTimestamp: Date.now(),
      reference: null,
      fetchReference: vi.fn(),
    };

    // Mock messages collection
    mockMessages = new Collection();
    mockMessages.set("message-123", mockMessage as Message);

    // Mock channel
    mockChannel = {
      id: "channel-789",
      name: "test-channel",
      viewable: true,
      messages: {
        fetch: vi.fn().mockResolvedValue(mockMessages),
      },
    };

    // Mock guild
    mockGuild = {
      id: "guild-123",
      name: "Test Guild",
      channels: {
        cache: new Collection([["channel-789", mockChannel as TextChannel]]),
        fetch: vi.fn(),
      },
    };

    // Mock client
    mockClient = {
      login: vi.fn().mockResolvedValue("token"),
      destroy: vi.fn(),
      guilds: {
        fetch: vi.fn().mockResolvedValue(mockGuild),
      },
    };

    // Mock Client constructor
    (Client as any).mockImplementation(() => mockClient);
  });

  describe("fetchHistoricalMessagesTool", () => {
    it("should successfully fetch and process messages", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      // Mock vector store query to return no existing messages
      (vectorStore.query as any).mockResolvedValue([]);
      (vectorStore.upsert as any).mockResolvedValue(undefined);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000, // 24 hours ago
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(1);
      expect(mockClient.login).toHaveBeenCalledWith(process.env.DISCORD_TOKEN);
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(vectorStore.upsert).toHaveBeenCalled();
    });

    it("should skip messages that already exist in vector store", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      // Mock vector store query to return existing message
      (vectorStore.query as any).mockResolvedValue([{ id: "existing-message" }]);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(0);
      expect(vectorStore.upsert).not.toHaveBeenCalled();
    });

    it("should skip empty messages", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      // Create message with empty content
      const emptyMessage = {
        ...mockMessage,
        content: "",
      };
      mockMessages.clear();
      mockMessages.set("empty-message", emptyMessage as Message);

      (vectorStore.query as any).mockResolvedValue([]);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(0);
      expect(vectorStore.upsert).not.toHaveBeenCalled();
    });

    it("should handle Missing Access error gracefully", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      const { logger } = await import("@/services/logger");
      
      const discordError = new DiscordAPIError(
        {
          message: "Missing Access",
          code: 50001,
        },
        50001,
        403,
        "GET",
        "https://discord.com/api/v10/channels/789/messages",
        {}
      );

      // Mock channel.messages.fetch to throw Missing Access error
      (mockChannel.messages!.fetch as any).mockRejectedValue(discordError);

      (handleDiscordAPIError as any).mockReturnValue({
        type: "MISSING_ACCESS",
        code: 50001,
        message: "Missing Access",
      });
      (isRecoverableDiscordError as any).mockReturnValue(true);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(0);
      expect(handleDiscordAPIError).toHaveBeenCalledWith(
        discordError,
        {
          channelId: "channel-789",
          guildId: "guild-123",
          operation: "fetchMessages",
        }
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle Unknown Message error when fetching references", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      const { vectorStore } = await import("@/agent/stores");
      
      // Create message with reference
      const messageWithReference = {
        ...mockMessage,
        reference: {
          messageId: "referenced-message-456",
          channelId: "channel-789",
          guildId: "guild-123",
        },
        fetchReference: vi.fn(),
      };

      const discordError = new DiscordAPIError(
        {
          message: "Unknown Message",
          code: 10008,
        },
        10008,
        404,
        "GET",
        "https://discord.com/api/v10/channels/789/messages/referenced-message-456",
        {}
      );

      // Mock fetchReference to throw Unknown Message error
      (messageWithReference.fetchReference as any).mockRejectedValue(discordError);

      mockMessages.clear();
      mockMessages.set("message-with-ref", messageWithReference as Message);

      (vectorStore.query as any).mockResolvedValue([]);
      (vectorStore.upsert as any).mockResolvedValue(undefined);
      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_MESSAGE",
        code: 10008,
        message: "Unknown Message",
      });
      (isRecoverableDiscordError as any).mockReturnValue(true);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(1);
      expect(handleDiscordAPIError).toHaveBeenCalledWith(
        discordError,
        {
          messageId: "referenced-message-456",
          channelId: "channel-789",
          guildId: "guild-123",
          operation: "fetchReference",
        }
      );
      // Should still process the message with fallback threadId
      expect(vectorStore.upsert).toHaveBeenCalled();
    });

    it("should skip non-viewable channels", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      // Make channel non-viewable
      mockChannel.viewable = false;

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(0);
      expect(mockChannel.messages!.fetch).not.toHaveBeenCalled();
      expect(vectorStore.upsert).not.toHaveBeenCalled();
    });

    it("should handle non-text channels", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      // Create a non-text channel mock
      const mockVoiceChannel = {
        id: "voice-channel-123",
        name: "voice-channel",
        type: 2, // Voice channel type
      };

      mockGuild.channels!.cache = new Collection([["voice-channel-123", mockVoiceChannel as any]]);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(0);
      expect(vectorStore.upsert).not.toHaveBeenCalled();
    });

    it("should handle fatal errors and cleanup properly", async () => {
      const { handleDiscordAPIError } = await import("@/utils/errors");
      const { logger } = await import("@/services/logger");
      
      const fatalError = new Error("Network connection failed");

      // Mock guild fetch to throw fatal error
      (mockClient.guilds!.fetch as any).mockRejectedValue(fatalError);

      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_ERROR",
        code: 0,
        message: "Network connection failed",
      });

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(false);
      expect(result.newMessagesAdded).toBe(0);
      expect(result.error).toBe("Network connection failed");
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it("should filter messages by date range", async () => {
      const { vectorStore } = await import("@/agent/stores");
      
      const now = Date.now();
      const oneDayAgo = now - 86400000;
      const twoDaysAgo = now - 172800000;

      // Create messages with different timestamps
      const oldMessage = {
        ...mockMessage,
        id: "old-message",
        createdTimestamp: twoDaysAgo, // Outside range
      };

      const newMessage = {
        ...mockMessage,
        id: "new-message",
        createdTimestamp: oneDayAgo + 3600000, // Within range
      };

      mockMessages.clear();
      mockMessages.set("old-message", oldMessage as Message);
      mockMessages.set("new-message", newMessage as Message);

      (vectorStore.query as any).mockResolvedValue([]);
      (vectorStore.upsert as any).mockResolvedValue(undefined);

      const context = {
        platformId: "guild-123",
        startDate: oneDayAgo,
        endDate: now,
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(1); // Only the new message should be processed
    });

    it("should handle message processing errors gracefully", async () => {
      const { handleDiscordAPIError, isRecoverableDiscordError } = await import("@/utils/errors");
      const { vectorStore } = await import("@/agent/stores");
      const { logger } = await import("@/services/logger");
      
      // Mock vector store query to throw error for one message
      (vectorStore.query as any)
        .mockResolvedValueOnce([]) // First message succeeds
        .mockRejectedValueOnce(new Error("Database error")); // Second message fails

      // Add another message
      const secondMessage = {
        ...mockMessage,
        id: "message-456",
        content: "Second message",
      };
      mockMessages.set("message-456", secondMessage as Message);

      (handleDiscordAPIError as any).mockReturnValue({
        type: "UNKNOWN_ERROR",
        code: 0,
        message: "Database error",
      });
      (isRecoverableDiscordError as any).mockReturnValue(false);

      const context = {
        platformId: "guild-123",
        startDate: Date.now() - 86400000,
        endDate: Date.now(),
      };

      const result = await fetchHistoricalMessagesTool.execute({ context });

      expect(result.success).toBe(true);
      expect(result.newMessagesAdded).toBe(1); // Only one message should be processed
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
