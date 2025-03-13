import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import { db } from "../../db";
import { automations, platformConnections } from "../../db/schema";
import { findUserByHandle } from "../../lib/privy";
import type { EventTrigger, VoiceChannelJoinRequirement } from "../../types";
import voiceChannelJoinValidator from "../../validators/discord/voiceChannelJoin";
import { distributeReward } from "../rewards";

export async function triggerAutomation(event: EventTrigger) {
  try {
    const user = await findUserByHandle(event.userId);

    if (!user) {
      console.log(`User not found for ${event.userId}`);
      // @TODO - Notify user that they need to connect their account
      return;
    }

    const connection = await db.query.platformConnections.findFirst({
      where: and(
        eq(platformConnections.platformId, event.platformId),
        eq(platformConnections.platformType, event.platformType as "discord" | "github"),
      ),
      with: {
        community: true,
      },
    });

    if (!connection) {
      console.log(`No community found for ${event.platformType} ID: ${event.platformId}`);
      return;
    }

    const community = connection.community;

    const matchingRules = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.communityId, community.id),
          eq(automations.eventType, event.eventType as "voice_channel_join"),
          eq(automations.isActive, true),
        ),
      );

    if (!matchingRules.length) {
      console.log(`No matching automation rules for event: ${event.eventType}`);
      return;
    }

    const hashes = await Promise.all(
      matchingRules.map(async (rule) => {
        let isValid = false;

        // @TODO - Check the subgraph that the user has not already completed the automation

        switch (rule.eventType) {
          case "voice_channel_join": {
            if (!event.metadata?.channelId) {
              console.log("Missing required channelId in event metadata");
              return null;
            }
            isValid = voiceChannelJoinValidator(
              rule.requirements as VoiceChannelJoinRequirement[],
              { channelId: event.metadata.channelId as string },
            );
            break;
          }
          default:
            console.log(`Unhandled event type: ${rule.eventType}`);
            return null;
        }

        if (!isValid) {
          console.log(`Rule ${rule.id} requirements not met`);
          return null;
        }

        console.log(`Processing rule ${rule.id} - all requirements met`);

        const hash = await distributeReward(event, rule);
        return hash;
      }),
    );

    return hashes.filter((hash): hash is Address => hash !== null);
  } catch (error) {
    console.error("Error processing community event:", error);
  }
}
