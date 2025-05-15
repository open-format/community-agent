import discordClient from "./discord";
import telegramClient from "./telegram";


// Only require GITHUB_WEBHOOK_SECRET in production
if (process.env.NODE_ENV === "production" && !process.env.GITHUB_WEBHOOK_SECRET) {
    throw new Error("GITHUB_WEBHOOK_SECRET must be set in production environment");
}

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
    throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN must be set");
}

export function ensureClients() {
    if (CLIENTS.discord) {
        console.log('Discord client configured');
    }
    if (CLIENTS.telegram) {
        telegramClient.launch({ dropPendingUpdates: true });
        telegramClient.telegram.setMyCommands([
            { command: 'link_community', description: 'Link a community with a verification code' },
        ]);    
        console.log('Telegram client configured');
    }
}
  
export const CLIENTS= {
    telegram: telegramClient,
    discord: discordClient,
};