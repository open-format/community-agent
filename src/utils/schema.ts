import { isAddress } from "viem";
import { z } from "zod";

export const addressSchema = z
  .string({ message: "Invalid Ethereum address" })
  .refine((value) => isAddress(value), "Invalid Ethereum address");
