export interface Community {
  id: string;
  name: string;
  owner: { id: string };
}

export interface Config {
  configurable: {
    metadata: { community: Community };
  };
}

export interface EventTrigger {
  platformId: string;
  platformType: string;
  eventType: string;
  userId: string;
  metadata: Record<string, unknown>;
}

export interface VoiceChannelJoinRequirement {
  start_time?: string;
  end_time?: string;
  channel_id?: string;
}
