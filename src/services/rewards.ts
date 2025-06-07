import { mastra } from "@/agent";
import { ReportStatus, storeReportResult, updateReportJobStatus } from "@/lib/redis";
import dayjs from "dayjs";
import {
    platformConnections as platformConnectionsSchema
} from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Runs rewards workflow for all platform connections linked to the community
 * passed as parameter. Returns a list of summaries (platformId, error?, duration)
 * for each platform connection execution. 
 * @param job_id 
 * @param community_id 
 * @param start_date 
 * @param end_date 
 * @returns 
 */
export async function generateRewardsInBackground(
    job_id: string,
    community_id: string,
    start_date: number,
    end_date: number,
) {
    const allRewards: any[] = [];
    const platformSummaries: Array<{
        platformId: string;
        durationMs: number;
        error?: string;
    }> = [];

    const platformConnections = await db
        .select()
        .from(platformConnectionsSchema)
        .where(eq(platformConnectionsSchema.communityId, community_id));

    if (platformConnections.length === 0) {
        return platformSummaries;
    }

    for (const platformConnection of platformConnections) {
        const startTime = Date.now();
        const summary: {platformId: string; durationMs: number; error?: string;} = {
            platformId: platformConnection.platformId,
            durationMs: 0,
            error: undefined,
        };
        try {
            const workflow = mastra.getWorkflow("rewardsWorkflow");
            const { start } = workflow.createRun();

            const result = await start({
                triggerData: {
                    community_id,
                    platform_id: platformConnection.platformId,
                    platform_type: platformConnection.platformType,
                    start_date: dayjs(start_date).valueOf(),
                    end_date: dayjs(end_date).valueOf(),
                },
            });

            if (result.results.getWalletAddresses?.status === "success") {
                allRewards.push(...result.results.getWalletAddresses.output.rewards);
            } else {
                summary.error = `Failed to analyze rewards for platform ${platformConnection.platformId} in community ${community_id}`;
            }

        } catch (error) {
            console.error(`Error generating rewards, platform: ${platformConnection.platformId}, community: ${community_id}:`, error);
            summary.error = error instanceof Error ? error.message : String(error);
        }
        summary.durationMs = Date.now() - startTime;
        platformSummaries.push(summary);
    }

    const allErrors: string[] = platformSummaries.map( ps => ps.error ).filter( s => s != undefined);

    if (allErrors.length === 0) {
        await storeReportResult(job_id, allRewards);
        await updateReportJobStatus(job_id, ReportStatus.COMPLETED);
    } else {
        await updateReportJobStatus(job_id, ReportStatus.FAILED, {
            error: allErrors.join('\n'),
        });
    }

    return platformSummaries;
}
