export interface TopContributor {
  username: string;
  messageCount: number;
}

export interface ChannelBreakdown {
  channelName: string;
  messageCount: number;
  uniqueUsers: number;
}

export interface KeyTopic {
  topic: string;
  messageCount: number;
  description: string;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  uniqueUsers: number;
}

export interface Sentiment {
  title: string;
  description: string;
  users: string[];
}

export interface ReportData {
  summaryId: string;
  timestamp: number;
  overview: {
    totalMessages: number;
    uniqueUsers: number;
    activeChannels: number;
  };
  topContributors: TopContributor[];
  channelBreakdown: ChannelBreakdown[];
  keyTopics: KeyTopic[];
  dailyActivity: DailyActivity[];
  userSentiment: {
    excitement: Sentiment[];
    frustrations: Sentiment[];
  };
}
