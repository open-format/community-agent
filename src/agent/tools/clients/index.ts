import { getMessageURL as getMessageURLDiscord } from "./discord";
import { getMessageURL as getMessageURLTelegram } from "./telegram";


export function getMessageUrlForPlatform(
    platform:string, 
    platformId: string, 
    channelId: string, 
    messageId: string
) {
    if (platform == "telegram") {
        return getMessageURLTelegram(platformId, channelId, messageId);
    }
    return getMessageURLDiscord(platformId, channelId, messageId);
}