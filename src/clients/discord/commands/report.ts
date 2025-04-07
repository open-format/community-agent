import { getReportResult } from "@/lib/redis";
import { generateReportInBackground } from "@/services/report-generation";
import type { Message } from "discord.js";
import { randomUUID } from "node:crypto";
import type { ReportData } from "../formatters/report";
import { createReportEmbeds } from "../formatters/report";

export async function handleReportCommand(msg: Message) {
  if (!msg.guild) {
    return;
  }

  try {
    // Send immediate acknowledgment
    const responseMsg = await msg.reply(
      "I'm generating a community impact report. This may take a few minutes. I'll post it here when it's ready! 📊",
    );

    // Generate a unique job ID
    const jobId = randomUUID();

    // Get timestamps for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Start report generation in background
    generateReportInBackground(jobId, startDate.getTime(), endDate.getTime(), msg.guild.id)
      .then(async () => {
        // Get the report result from Redis
        const reportResult = await getReportResult(jobId);
        if (!reportResult) {
          await responseMsg.edit(
            "Sorry, there was an error generating the report. Please try again.",
          );
          return;
        }

        const report = reportResult as ReportData;
        const embeds = createReportEmbeds(report.report);

        await responseMsg.edit({
          content:
            "Your community report is ready! 🎉\nHere's a detailed breakdown of the last 30 days:",
          embeds,
        });
      })
      .catch(async (error: unknown) => {
        console.error("Error in report generation:", error);
        await responseMsg.edit(
          "Sorry, there was an error generating the report. Please try again.",
        );
      });
  } catch (error) {
    console.error("Error initiating report generation:", error);
    await msg.reply("Sorry, there was an error starting the report generation. Please try again.");
  }
}
