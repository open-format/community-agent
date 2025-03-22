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
    timestamp: number;
    text: string;
    isReaction?: boolean;
  }

  // Define interface for the summary metadata
  interface SummaryMetadata {
    platform?: string;
    platformId: string;
    timestamp: number;
    text: string;
    startDate: number;
    endDate: number;
    summarizationScore?: number | null;
    coverageScore?: number | null;
    alignmentScore?: number | null;
    summarizationReason?: string | null;
  }

  interface getMessagesToolContext {
    context: {
      startDate: number;
      endDate: number;
      platformId: string;
    };
  }

  interface VectorStoreResult {
    id: string;
    score: number;
    metadata: MessageMetadata;
  }

  interface MessageStats {
    messageCount: number;
    uniqueUserCount: number;
    messagesByDate: DateStat[];
    topContributors: ContributorStat[];
    messagesByChannel: ChannelStat[];
  }

  interface ChannelStat {
    channel: {
      id: string;
      name: string;
    };
    count: number;
    uniqueUsers: number;
  }

  interface ContributorStat {
    username: string;
    count: number;
  }

  interface DateStat {
    date: string;
    count: number;
    uniqueUsers: number;
  }

}

declare module "hono" {
  interface ContextVariableMap {
    communityId: string | undefined;
  }
}

export {};
