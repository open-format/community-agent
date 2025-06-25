import { logger } from "@/services/logger";
import { DiscordAPIError, MessageFlags } from "discord.js";
import { BaseError, ContractFunctionRevertedError } from "viem";

// Define possible error types for better type safety
export type ViemErrorType =
  | "INSUFFICIENT_BALANCE"
  | "EXCEEDS_MAX_AMOUNT"
  | "INVALID_TOKEN_ADDRESS"
  | "GAS_LIMIT_EXCEEDED"
  | "INSUFFICIENT_FUNDS"
  | "EXECUTION_REVERTED"
  | "UNKNOWN_ERROR";

export interface ViemErrorDetails {
  type: ViemErrorType;
  message: string;
  context?: "simulation" | "execution";
  originalError?: unknown;
  errorName?: string;
  errorArgs?: unknown[];
}

export interface DiscordErrorResponse {
  content: string;
  flags: MessageFlags;
}

export function handleViemError(
  err: unknown,
  context: "simulation" | "execution" = "execution",
): ViemErrorDetails {
  console.error(`${context} error:`, err);

  if (err instanceof BaseError) {
    // Walk the error chain to find ContractFunctionRevertedError
    const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName ?? "";
      const errorArgs = revertError.data?.args;

      // Log detailed error information for debugging
      console.error("Contract revert error:", {
        name: errorName,
        args: errorArgs,
        data: revertError.data,
      });

      // Handle specific custom errors
      switch (errorName) {
        case "InsufficientBalance":
          return {
            type: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance in the wallet",
            context,
            errorName,
            errorArgs,
            originalError: err,
          };
        case "ExceedsMaxAmount":
          return {
            type: "EXCEEDS_MAX_AMOUNT",
            message: "The amount exceeds the maximum allowed",
            context,
            errorName,
            errorArgs,
            originalError: err,
          };
        case "InvalidTokenAddress":
          return {
            type: "INVALID_TOKEN_ADDRESS",
            message: "The token address is invalid",
            context,
            errorName,
            errorArgs,
            originalError: err,
          };
      }
    }

    // Handle other common Viem errors
    if (err.message) {
      if (err.message.includes("gas required exceeds allowance")) {
        return {
          type: "GAS_LIMIT_EXCEEDED",
          message: "Not enough gas to execute the transaction",
          context,
          originalError: err,
        };
      }

      if (err.message.includes("insufficient funds")) {
        return {
          type: "INSUFFICIENT_FUNDS",
          message: "Insufficient funds to cover gas costs",
          context,
          originalError: err,
        };
      }

      if (err.message.includes("execution reverted")) {
        return {
          type: "EXECUTION_REVERTED",
          message: "Transaction reverted",
          context,
          originalError: err,
        };
      }
    }
  }

  // Fallback error
  return {
    type: "UNKNOWN_ERROR",
    message: `${context} failed`,
    context,
    originalError: err,
  };
}

export function formatViemErrorForDiscord(error: ViemErrorDetails): DiscordErrorResponse {
  const content = `Transaction failed: ${error.message}.`;

  return {
    content,
    flags: MessageFlags.Ephemeral,
  };
}

// Discord API Error Types
export type DiscordErrorType =
  | "MISSING_ACCESS"
  | "UNKNOWN_MESSAGE"
  | "UNKNOWN_CHANNEL"
  | "RATE_LIMITED"
  | "UNKNOWN_ERROR";

export interface DiscordErrorDetails {
  type: DiscordErrorType;
  code: number;
  message: string;
  context?: {
    channelId?: string;
    messageId?: string;
    guildId?: string;
    operation?: string;
  };
  originalError?: unknown;
}

/**
 * Handle Discord API errors with proper logging and error classification
 * @param error The error object from Discord API
 * @param context Additional context about where the error occurred
 * @returns Structured error details
 */
export function handleDiscordAPIError(
  error: unknown,
  context?: {
    channelId?: string;
    messageId?: string;
    guildId?: string;
    operation?: string;
  },
): DiscordErrorDetails {
  if (error instanceof DiscordAPIError) {
    const errorDetails: DiscordErrorDetails = {
      type: getDiscordErrorType(error.code),
      code: error.code,
      message: error.message,
      context,
      originalError: error,
    };

    // Log the error with structured context
    logger.warn(
      {
        discordError: {
          code: error.code,
          message: error.message,
          method: error.method,
          url: error.url,
          status: error.status,
        },
        context,
      },
      `Discord API Error: ${error.message}`,
    );

    return errorDetails;
  }

  // Handle non-Discord API errors
  const errorDetails: DiscordErrorDetails = {
    type: "UNKNOWN_ERROR",
    code: 0,
    message: error instanceof Error ? error.message : "Unknown error occurred",
    context,
    originalError: error,
  };

  logger.error(
    {
      error: error instanceof Error ? error.message : error,
      context,
    },
    "Non-Discord API error occurred",
  );

  return errorDetails;
}

/**
 * Map Discord API error codes to our error types
 * @param code Discord API error code
 * @returns Corresponding error type
 */
function getDiscordErrorType(code: number): DiscordErrorType {
  switch (code) {
    case 50001:
      return "MISSING_ACCESS";
    case 10008:
      return "UNKNOWN_MESSAGE";
    case 10003:
      return "UNKNOWN_CHANNEL";
    case 429:
      return "RATE_LIMITED";
    default:
      return "UNKNOWN_ERROR";
  }
}

/**
 * Check if an error is a recoverable Discord API error
 * @param errorDetails Discord error details
 * @returns True if the error is recoverable and operation can continue
 */
export function isRecoverableDiscordError(errorDetails: DiscordErrorDetails): boolean {
  return ["MISSING_ACCESS", "UNKNOWN_MESSAGE", "UNKNOWN_CHANNEL"].includes(errorDetails.type);
}

export function handleDiscordClientError(
  error: Error,
  context?: {
    operation?: string;
    guildId?: string;
  },
): void {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    },
    "Discord client error occurred",
  );
}
