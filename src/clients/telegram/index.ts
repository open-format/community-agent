import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import { createPlatformConnection, deletePlatformConnection } from "@/db/commons/platform";
import { VerificationResult, verifyCommunity } from "@/lib/verification";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { getReport } from "./commands/report";

const telegramOptions = {
  telegram: {
    apiRoot: process.env.TELEGRAM_API_ROOT || "https://api.telegram.org",
  },
};

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}
const telegramClient = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, telegramOptions);

telegramClient.start(async (ctx) => {
  if (ctx.chat.type === "private") {
    const payload = ctx.message.text.split(" ")[1] || "";
    if (payload === "link") {
      let callbackUrl = null;
      try {
        const platformConnection = await db.query.platformConnections.findFirst({
          where: (connections, { eq }) => eq(connections.platformType, "telegram"),
        });

        if (platformConnection) {
          const platformBaseUrl = process.env.PLATFORM_URL || "https://your-platform-url.com";
          callbackUrl = `${platformBaseUrl}/api/telegram/callback?platformConnectionId=${platformConnection?.id}`;
        } else {
          console.warn("[Telegram] No platform connections found for DM onboarding.");
        }
      } catch (err) {
        console.error(
          "[Telegram] Error fetching platform connections for DM onboarding:",
          err instanceof Error ? err.message : String(err),
        );
      }
      if (callbackUrl) {
        try {
          await ctx.reply(
            "🎉 The bot has been added to your group!\n\n" +
              "To finish linking your group to your Platform community, please click the button below and follow the instructions.\n\n" +
              "If you have any issues, return to the Platform and try again, or type /help.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Finish Linking Group",
                      url: callbackUrl,
                    },
                  ],
                ],
              },
            },
          );
        } catch (err) {
          console.error(
            "[Telegram] Error sending callback link in DM:",
            err instanceof Error ? err.message : String(err),
          );
          await ctx.reply("❌ Failed to send the linking button. Please return to the Platform.");
        }
      } else {
        await ctx.reply(
          "❌ The bot has been added to your group, but we couldn't find your group connection. Please return to the Platform to finish linking, or type /help.",
        );
      }
    } else {
      await ctx.reply(
        "Hi! Use the Platform to start connecting your group, or type /help for more options.",
      );
    }
  }
});
telegramClient.help((ctx) =>
  ctx.reply("I am OPENFORMAT telegram bot. I only work in group chats."),
);

telegramClient.on(message("new_chat_members"), async (ctx) => {
  try {
    const newMembers = ctx.message.new_chat_members;
    const isBotAdded = newMembers.some((member) => member.id === ctx.botInfo.id);

    if (isBotAdded) {
      console.log(`Telegram Bot joined new Chat: ${ctx.chat.id}`);

      const name =
        ctx.chat.type === "group" || ctx.chat.type === "supergroup"
          ? ctx.chat.title
          : ctx.chat.id.toString();

      let platformConnection = null;
      try {
        [platformConnection] = await createPlatformConnection(
          ctx.chat.id.toString(),
          name,
          "telegram",
        );
      } catch (err) {
        console.error(
          "[Telegram] Error creating platform connection:",
          err instanceof Error ? err.message : String(err),
        );
        await ctx.reply("❌ Failed to create platform connection. Please try again later.");
        return;
      }
      const platformConnectionId = platformConnection?.id;
      console.log("platformConnection result:", platformConnection);
      if (!platformConnectionId) {
        await ctx.reply("❌ Platform connection could not be created. Please try again later.");
        return;
      }
      if (!process.env.PLATFORM_URL) {
        console.error("[Telegram] PLATFORM_URL is not set in environment variables.");
        await ctx.reply("❌ Platform URL is not correctly configured.");
        return;
      }
      await ctx.reply(
        "👋 Thanks for adding me! To finish setup, please click the button below to get your private link.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Open DM",
                  url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=link`,
                },
              ],
            ],
          },
        },
      );
    }
  } catch (error) {
    console.error("[Telegram] Error in new_chat_members handler:", error);
    try {
      await ctx.reply(
        "❌ An unexpected error occurred while processing your request. Please try again later or contact support.",
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Telegram] Failed to send error message to group:", errMsg);
    }
  }
});

telegramClient.on("my_chat_member", async (ctx) => {
  const chat = ctx.chat;
  const newStatus = ctx.myChatMember.new_chat_member.status;

  if (chat && (newStatus === "left" || newStatus === "kicked")) {
    console.log(`Telegram Bot removed from Chat: ${ctx.chat.id}`);

    await deletePlatformConnection(chat.id.toString(), "telegram");
  }
});

telegramClient.command("link_community", async (ctx) => {
  const chat = ctx.chat;
  const messageText = ctx.message.text;
  const args = messageText.split(" ").slice(1); // Extract arguments after the command
  const platformId = chat.id.toString();

  // Ensure the command is executed in a group
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
    return ctx.reply("Command /link_community can only be used in a group.");
  }

  // Check if the user is an administrator
  const userId = ctx.from.id;
  try {
    const administrators = await ctx.telegram.getChatAdministrators(chat.id);
    const isAdmin = administrators.some((admin) => admin.user.id === userId);

    if (!isAdmin) {
      return ctx.reply("Command /link_community can only be executed by the group Administrators.");
    }
  } catch (error) {
    console.error("Error fetching group administrators:", error);
    return ctx.reply(
      "An error occurred while verifying administrator privileges. Please try again later.",
    );
  }

  if (args.length === 0) {
    return ctx.reply(
      "Please provide a verification code. Usage: /link_community <verification_code>",
    );
  }

  const code = args[0];

  try {
    const verificationResult = await verifyCommunity(code, platformId, "telegram");

    try {
      // Just try to delete message with the code
      await ctx.deleteMessage();
    } catch (err) {
      // No problem, we do not have permissions for that in this group.
    }

    if (VerificationResult.FAILED === verificationResult) {
      return ctx.reply("Invalid or expired verification code.");
    }

    if (VerificationResult.USED === verificationResult) {
      return ctx.reply("This verification code has already been used.");
    }

    return ctx.reply(
      "✅ Server verified successfully! Your server is now linked to the community.",
    );
  } catch (error) {
    console.error("Error linking community:", error);
    ctx.reply("An error occurred while linking the community. Please try again later.");
  }
});

telegramClient.command("report", async (ctx) => {
  const chat = ctx.chat;

  // Ensure the command is executed in a group
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
    return ctx.reply("Command /report can only be used in a group.");
  }

  // Check if the user is an administrator
  const userId = ctx.from.id;
  try {
    const administrators = await ctx.telegram.getChatAdministrators(chat.id);
    const isAdmin = administrators.some((admin) => admin.user.id === userId);

    if (!isAdmin) {
      return ctx.reply("Command /report can only be executed by the group Administrators.");
    }
  } catch (error) {
    console.error("Error fetching group administrators:", error);
    return ctx.reply(
      "An error occurred while verifying administrator privileges. Please try again later.",
    );
  }

  try {
    const report = await getReport(ctx.chat.id.toString());
    ctx.replyWithMarkdownV2(report);
  } catch (error) {
    console.error("Error showing report:", error);
    ctx.reply("An error occurred while showing the report. Please try again later.");
  }
});

telegramClient.on("message", async (ctx) => {
  try {
    if (!ctx.chat?.id) {
      return; // Ensure we are in a chat
    }
    if (!ctx.message || !ctx.from) {
      return; // Exit if no message or sender info
    }
    // shouldIgnoreBotMessages: true
    if (ctx.from.is_bot) {
      return;
    }
    // shouldIgnoreDirectMessages: true
    if (ctx.chat?.type === "private") {
      return;
    }
    // Message
    const message = ctx.message;
    // Message text
    let messageText = "";
    if ("text" in message) {
      messageText = message.text;
    } else if ("caption" in message && message.caption) {
      messageText = message.caption;
    }
    if (!messageText) {
      return; // No message to store
    }

    // userID
    const userId = ctx.from.id.toString();
    // Get user name
    const userName = ctx.from.username || ctx.from.first_name || "Unknown User";
    // Get chat ID
    const chatId = ctx.chat.id.toString();
    // Get message ID
    const messageId = message.message_id.toString();
    // Get text or caption

    // Generate embeddings for message content
    const embedding = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: messageText,
    });

    // Initialize metadata for the message
    const metadata: MessageMetadata = {
      platform: "telegram",
      platformId: chatId,
      messageId: messageId,
      authorId: userId,
      authorUsername: userName,
      channelId: chatId,
      threadId: messageId,
      timestamp: message.date * 1000,
      text: messageText,
      isBotQuery: message.from.is_bot,
      isReaction: false,
      checkedForReward: false,
    };

    // If this is a reply to another message, get the parent message's ID
    if ("reply_to_message" in message && message.reply_to_message) {
      metadata.threadId = message.reply_to_message.message_id.toString();
    }

    // Store in vector store
    await vectorStore.upsert({
      indexName: "community_messages",
      vectors: [embedding.embedding],
      metadata: [metadata],
    });
    console.log(`Stored message from Telegram chat ${message.chat.id}`);
  } catch (error) {
    console.log("Error handling Telegram message:", error);
    // Don't try to reply if we've left the group or been kicked
    if (error && typeof error === "object" && "response" in (error as { response?: any })) {
      if ((error as { response: { error_code?: number } }).response?.error_code !== 403) {
        try {
          await ctx.reply("An error occurred while processing your message.");
        } catch (replyError) {
          console.log("Failed to send Telegram error message:", replyError);
        }
      }
    } else {
      console.error("Error (generic) handling Telegram message:", error);
    }
  }
});

telegramClient.catch((err, ctx) => {
  console.log(`Telegram Error for ${ctx.updateType}:`, err);
});

const shutdownHandler = async (signal: string) => {
  console.log(`Telegram Client received ${signal}. Shutting down Telegram bot gracefully...`);
  try {
    console.log("Stopping Telegram bot...");
    telegramClient.stop();
    console.log("Telegram bot stopped gracefully");
  } catch (error) {
    console.log("Error during Telegram bot shutdown:", error);
    throw error;
  }
};

process.once("SIGINT", () => shutdownHandler("SIGINT"));
process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
process.once("SIGHUP", () => shutdownHandler("SIGHUP"));

export default telegramClient;
