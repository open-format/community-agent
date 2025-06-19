import { vectorStore } from "@/agent/stores";
import {
	createPlatformConnection,
	deletePlatformConnection,
} from "@/db/commons/platform";
import {
	VerificationResult,
	verifyCommunity,
	getVerificationData,
} from "@/lib/verification";
import redis from "@/lib/redis";
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
const telegramClient = new Telegraf(
	process.env.TELEGRAM_BOT_TOKEN,
	telegramOptions,
);

telegramClient.start(async (ctx) => {
	let payload = "";
	if (ctx.chat.type === "private") {
		payload = ctx.message.text.split(" ")[1] || "";
	} else {
		const parts = ctx.message.text.split(" ");
		if (parts.length > 1) {
			payload = parts[1] || "";
		}
	}

	// Handle start with verification code (user initiated from platform)
	if (payload) {
		try {
			const verificationCode = payload;

			const verificationData = await getVerificationData(verificationCode);

			if (!verificationData) {
				console.error(
					"[Telegram] Invalid verification code:",
					verificationCode,
				);
				await ctx.reply(
					"Invalid or expired verification code. Please try connecting again from the platform.",
				);
				return;
			}

			if (verificationData.used) {
				console.error(
					"[Telegram] Verification code already used:",
					verificationCode,
				);
				await ctx.reply(
					"This verification code has already been used. Please try connecting again from the platform.",
				);
				return;
			}

			// Store verification code in Redis with user ID as key
			await redis.set(
				`telegram:pending:${ctx.from.id}`,
				verificationCode,
				"EX",
				600, // 10 minutes
			);

			if (ctx.chat.type === "private") {
				try {
					await ctx.reply(
						"👋 Welcome! To connect your community, please add me to your Telegram group using the button below.",
						{
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: "Add to Group",
											url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?startgroup=${verificationCode}`,
										},
									],
								],
							},
						},
					);
				} catch (replyError) {
					console.error(
						"[Telegram] Error sending welcome message:",
						replyError,
					);
					await ctx.reply(
						"👋 Welcome! To connect your community, please add me to your Telegram group.",
					);
				}
			}
			return;
		} catch (error) {
			console.error("[Telegram] Error processing verification code:", error);
			// Fall through to default message
		}
	}

	// Handle start without verification code
	if (ctx.chat.type === "private") {
		await ctx.reply(
			"Hello! I am the OpenFormat Community Copilot. To use my features, please visit https://app.openformat.tech to create an account and get started.",
		);
	}
});

telegramClient.help((ctx) =>
	ctx.reply(
		"Hello! I am the OpenFormat Community Copilot. To use my features, please visit https://app.openformat.tech to create an account and get started.\n\n",
	),
);

telegramClient.on(message("new_chat_members"), async (ctx) => {
	try {
		const newMembers = ctx.message.new_chat_members;
		const isBotAdded = newMembers.some(
			(member) => member.id === ctx.botInfo.id,
		);

		if (isBotAdded) {
			const name =
				ctx.chat.type === "group" || ctx.chat.type === "supergroup"
					? ctx.chat.title
					: ctx.chat.id.toString();

			try {
				// Create platform connection
				const platformConnections = await createPlatformConnection(
					ctx.chat.id.toString(),
					name,
					"telegram",
				);

				const platformConnection = platformConnections?.[0];

				if (platformConnection?.id) {
					const storedVerificationCode = await redis.get(
						`telegram:pending:${ctx.from.id}`,
					);

					const platformBaseUrl = process.env.PLATFORM_URL;
					if (platformBaseUrl) {
						let callbackUrl = `${platformBaseUrl}/api/telegram/callback?platformConnectionId=${platformConnection.id}`;

						if (storedVerificationCode) {
							const verificationData = await getVerificationData(
								storedVerificationCode,
							);

							if (verificationData && !verificationData.used) {
								callbackUrl += `&state=${encodeURIComponent(storedVerificationCode)}`;
								await redis.del(`telegram:pending:${ctx.from.id}`);
							}
						}

						try {
							await ctx.telegram.sendMessage(
								ctx.from.id,
								"🎉 Your Telegram group has been successfully connected!\n\n" +
									"Click the button below to complete the setup and access your community dashboard.",
								{
									reply_markup: {
										inline_keyboard: [
											[
												{
													text: "Complete Setup",
													url: callbackUrl,
												},
											],
										],
									},
								},
							);
						} catch (error) {
							console.error(
								"[Telegram] Failed to send callback link to user:",
								error,
							);
						}
					}
				}
			} catch (err) {
				console.error(
					"[Telegram] Error creating platform connection:",
					err instanceof Error ? err.message : String(err),
				);
				await ctx.telegram.sendMessage(
					ctx.from.id,
					"❌ Failed to create platform connection. Please try again later.",
				);
				return;
			}
		}
	} catch (error) {
		console.error("[Telegram] Error in new_chat_members handler:", error);
		try {
			await ctx.telegram.sendMessage(
				ctx.from.id,
				"❌ An unexpected error occurred while processing your request. Please try again later or contact support.",
			);
		} catch (err) {
			console.error("[Telegram] Failed to send error message to user:", err);
		}
	}
});

telegramClient.on("my_chat_member", async (ctx) => {
	const chat = ctx.chat;
	const newStatus = ctx.myChatMember.new_chat_member.status;

	if (chat && (newStatus === "left" || newStatus === "kicked")) {
		await deletePlatformConnection(chat.id.toString(), "telegram");
	}
});

telegramClient.command("link_community", async (ctx) => {
	const chat = ctx.chat;
	const messageText = ctx.message.text;
	const args = messageText.split(" ").slice(1); // Extract arguments after the command
	const platformId = chat.id.toString();

	if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
		return ctx.reply("Command /link_community can only be used in a group.");
	}

	const userId = ctx.from.id;
	try {
		const administrators = await ctx.telegram.getChatAdministrators(chat.id);
		const isAdmin = administrators.some((admin) => admin.user.id === userId);

		if (!isAdmin) {
			return ctx.reply(
				"Command /link_community can only be executed by the group Administrators.",
			);
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
		const verificationResult = await verifyCommunity(
			code,
			platformId,
			"telegram",
		);

		try {
			await ctx.deleteMessage();
		} catch (err) {}

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
		ctx.reply(
			"An error occurred while linking the community. Please try again later.",
		);
	}
});

telegramClient.command("report", async (ctx) => {
	const chat = ctx.chat;

	if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
		return ctx.reply("Command /report can only be used in a group.");
	}

	const userId = ctx.from.id;
	try {
		const administrators = await ctx.telegram.getChatAdministrators(chat.id);
		const isAdmin = administrators.some((admin) => admin.user.id === userId);

		if (!isAdmin) {
			return ctx.reply(
				"Command /report can only be executed by the group Administrators.",
			);
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
		ctx.reply(
			"An error occurred while showing the report. Please try again later.",
		);
	}
});

telegramClient.on("message", async (ctx) => {
	try {
		if (!ctx.chat?.id) {
			return;
		}
		if (!ctx.message || !ctx.from) {
			return;
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
			return;
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
		if (
			error &&
			typeof error === "object" &&
			"response" in (error as { response?: unknown })
		) {
			if (
				(error as { response: { error_code?: number } }).response
					?.error_code !== 403
			) {
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
	console.log(
		`Telegram Client received ${signal}. Shutting down Telegram bot gracefully...`,
	);
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
