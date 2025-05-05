import { Telegraf } from 'telegraf';

export async function buildChannelNameMap(channelIds: string[]): Promise<Map<string, string>> {
  const telegramClient = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
  const channelMap = new Map<string, string>();
  try {
    // Filter out "unknown-channel" before making API calls
    const validChannelIds = channelIds.filter((id) => id !== "unknown-channel");

    await Promise.all(
      validChannelIds.map(async (channelId) => {
        try {
          const chat = await telegramClient.telegram.getChat(channelId);
          if (chat && "title" in chat && chat.title) {
            channelMap.set(channelId, chat.title);
          } else if (chat && "username" in chat && chat.username) {
            channelMap.set(channelId, chat.username);
          } else {
            channelMap.set(channelId, "unknown");
          }
        } catch (error) {
          console.error(`Failed to fetch channel name for ${channelId}:`, error);
          channelMap.set(channelId, "unknown");
        }
      }),
    );

    // Set unknown-channel explicitly
    channelMap.set("unknown-channel", "Unknown Channel");
  } catch (error) {
    console.error("Failed to initialize Telegram client:", error);
  }

  return channelMap;
}
