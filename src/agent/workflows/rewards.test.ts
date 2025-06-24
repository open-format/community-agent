import "dotenv/config";
import { describe, expect, it } from "vitest";
import { identifyRewards } from "../agents/rewards";

describe("identifyRewards (integration)", () => {
  it("should return contributions from a real AI call", async () => {
    // Use a realistic transcript that should yield a contribution
    const transcript = `
      Alice: I fixed the login bug that was preventing users from accessing the dashboard.
      Bob: Thanks Alice! That was a big help.
    `;

    const result = await identifyRewards(transcript);

    // Basic assertions: structure and at least one contribution
    expect(result).toHaveProperty("contributions");
    expect(Array.isArray(result.contributions)).toBe(true);
    expect(result.contributions.length).toBeGreaterThan(0);
  });
});
