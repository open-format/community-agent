import Redis from "ioredis";

// Create Redis client with connection details from environment variables
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Constants for key prefixes
export const REPORT_STATUS_PREFIX = "report:status:";
export const REPORT_RESULT_PREFIX = "report:result:";

// Add this constant at the top with other constants
const REDIS_EXPIRATION = 300; // 5 minutes in seconds

// Report job status enum
export enum ReportStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Interface for report job information
export interface ReportJob {
  id: string;
  status: ReportStatus;
  startDate: number;
  endDate: number;
  platformId: string;
  createdAt: number;
  reportId?: string;
  error?: string;
}

/**
 * Create a new report job in Redis
 */
export async function createReportJob(
  jobId: string,
  platformId: string,
  startDate: number,
  endDate: number,
): Promise<ReportJob> {
  const job: ReportJob = {
    id: jobId,
    status: ReportStatus.PENDING,
    startDate,
    endDate,
    platformId,
    createdAt: Date.now(),
  };

  await redis.set(`${REPORT_STATUS_PREFIX}${jobId}`, JSON.stringify(job), "EX", REDIS_EXPIRATION);

  return job;
}

/**
 * Update the status of a report job
 */
export async function updateReportJobStatus(
  jobId: string,
  status: ReportStatus,
  additionalData: Partial<ReportJob> = {},
): Promise<ReportJob | null> {
  const jobData = await redis.get(`${REPORT_STATUS_PREFIX}${jobId}`);

  if (!jobData) {
    return null;
  }

  const job: ReportJob = JSON.parse(jobData);
  const updatedJob: ReportJob = {
    ...job,
    status,
    ...additionalData,
  };

  await redis.set(
    `${REPORT_STATUS_PREFIX}${jobId}`,
    JSON.stringify(updatedJob),
    "EX",
    REDIS_EXPIRATION,
  );

  return updatedJob;
}

/**
 * Get the current status of a report job
 */
export async function getReportJob(jobId: string): Promise<ReportJob | null> {
  const jobData = await redis.get(`${REPORT_STATUS_PREFIX}${jobId}`);

  if (!jobData) {
    return null;
  }

  return JSON.parse(jobData);
}

/**
 * Store the report result in Redis
 */
export async function storeReportResult(jobId: string, reportData: unknown): Promise<void> {
  await redis.set(
    `${REPORT_RESULT_PREFIX}${jobId}`,
    JSON.stringify(reportData),
    "EX",
    REDIS_EXPIRATION,
  );
}

/**
 * Get the report result from Redis
 */
export async function getReportResult(jobId: string): Promise<unknown | null> {
  const reportData = await redis.get(`${REPORT_RESULT_PREFIX}${jobId}`);

  if (!reportData) {
    return null;
  }

  return JSON.parse(reportData);
}

interface VerificationData {
  communityId: string;
  used: boolean;
  createdAt: number;
}

export const VERIFICATION_CODE_TTL = 600; // 10 minutes in seconds

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

export default redis;
