declare global {
  interface Community {
    id: string;
    name: string;
    owner: { id: string };
  }

  interface Config {
    configurable: {
      metadata: { community: Community };
    };
  }

  interface EventTrigger {
    platformId: string;
    platformType: string;
    eventType: string;
    userId: string;
    metadata: Record<string, unknown>;
  }

  interface VoiceChannelJoinRequirement {
    start_time?: string;
    end_time?: string;
    channel_id?: string;
  }

  interface MessageMetadata {
    platform: "discord" | "telegram" | "twitter";
    platformId: string;
    messageId: string;
    authorId: string;
    authorUsername: string;
    threadId: string; // Common across platforms but implemented differently
    channelId?: string; // Discord/Telegram specific
    timestamp: number; // Unix timestamp
    text: string;
    isReaction?: boolean;
    isBotQuery?: boolean;
  }
}

// This export statement is needed to make this file a module
export {};
