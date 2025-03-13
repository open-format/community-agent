import type { VoiceChannelJoinRequirement } from "../../types";
import { validateTimeWindow } from "../../utils/time";

/**
 * Validates voice channel join requirements
 */
export default function voiceChannelJoinValidator(
  requirements: VoiceChannelJoinRequirement[],
  metadata: {
    channelId: string;
  },
): boolean {
  if (!requirements || !requirements.length) return true;

  for (const req of requirements) {
    if (req.channel_id && req.channel_id !== metadata.channelId) {
      console.log("Channel ID does not match");
      return false;
    }

    if (!validateTimeWindow(req.start_time, req.end_time)) {
      console.log("Time window does not match");
      return false;
    }
  }

  return true;
}
