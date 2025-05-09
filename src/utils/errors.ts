import { MessageFlags } from "discord.js";
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
