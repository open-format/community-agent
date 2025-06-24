import { handleDiscordAPIError, isRecoverableDiscordError } from "@/utils/errors";
import type { Message } from "discord.js";

export async function getThreadStartMessageId(msg: Message): Promise<string> {
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
        messageId: currentMsg.reference?.messageId || "",
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
}
