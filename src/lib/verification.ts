import { platformConnections } from "@/db/schema";
import redis from "./redis";
import { db } from "@/db";
import { eq } from "drizzle-orm";

interface VerificationData {
    communityId: string;
    used: boolean;
    createdAt: number;
}

export enum VerificationResult {
    SUCCESS = "success",
    FAILED = "failed",
    USED = "failed_used",
};

export const VERIFICATION_CODE_TTL = 600; // 10 minutes in seconds

export async function verifyCommunity(
    code: string,
    platformId: string,
    platformType: "discord" | "github" | "telegram"
): Promise<VerificationResult> {
    // Verify the code
    const data = await getVerificationData(code);

    if (!data) {
        return VerificationResult.FAILED;
    }

    if (data.used) {
        return VerificationResult.USED;
    }

    // Mark code as used
    await markCodeAsUsed(code, data);

    // Store guild verification with community ID
    await storeGuildVerification(platformId, data.communityId);

    // Check if platform connection already exists
    const existingConnection = await db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.platformId, platformId))
        .limit(1);

    // Create or update the platform connection with the community ID
    if (existingConnection.length > 0) {
        await db
            .update(platformConnections)
            .set({
                communityId: data.communityId,
                updatedAt: new Date(),
            })
            .where(eq(platformConnections.platformId, platformId));
    } else {
        await db.insert(platformConnections).values({
            platformId: platformId,
            platformType: platformType,
            communityId: data.communityId,
        });
    }

    return VerificationResult.SUCCESS;
}

export async function storeVerificationCode(code: string, communityId: string): Promise<void> {
    const data: VerificationData = {
        communityId,
        used: false,
        createdAt: Date.now(),
    };

    await redis.set(`verify:code:${code}`, JSON.stringify(data), "EX", VERIFICATION_CODE_TTL);
}

export async function getVerificationData(code: string): Promise<VerificationData | null> {
    const data = await redis.get(`verify:code:${code}`);
    return data ? JSON.parse(data) : null;
}

export async function markCodeAsUsed(code: string, data: VerificationData): Promise<void> {
    await redis.set(
        `verify:code:${code}`,
        JSON.stringify({ ...data, used: true }),
        "EX",
        VERIFICATION_CODE_TTL,
    );
}

export function generateVerificationCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function storeGuildVerification(guildId: string, communityId: string): Promise<void> {
    await redis.set(
        `verified:guild:${guildId}`,
        JSON.stringify({
            communityId,
            verifiedAt: Date.now(),
        }),
    );
}

