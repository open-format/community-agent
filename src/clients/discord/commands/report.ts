import { vectorStore } from "@/agent/stores/vectorStore";
import dayjs from "dayjs";
import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import type { ReportData } from "../formatters/report";

export async function handleReportCommand(msg: Message) {
  if (!msg.guild) {
    return;
  }

  try {
    const results: { metadata: ReportData; score: number }[] = await vectorStore.query({
      indexName: "impact_reports",
      queryVector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        platformId: msg.guild.id,
      },
    });

    if (results.length === 0) {
      await msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("No Impact Report Available")
            .setDescription("There are no impact reports available for this community yet.")
            .addFields({
              name: "Next Report",
              value:
                "Impact reports are generated every 2 weeks. The next report will be available soon.",
            }),
        ],
      });
      return;
    }

    const report = results[0].metadata;
    const nextReportDate = dayjs(report.timestamp).add(14, "days");

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Community Impact Report")
      .setDescription(`Latest insights from your community's activity.`)
      .addFields(
        {
          name: "📊 Overview",
          value: `• ${report.overview.totalMessages.toLocaleString()} total messages\n• ${report.overview.uniqueUsers.toLocaleString()} unique participants\n• ${report.overview.activeChannels} active channels`,
          inline: false,
        },
        {
          name: "🏆 Top Contributors",
          value: report.topContributors
            .slice(0, 3)
            .map(
              (contributor) =>
                `• ${contributor.username}: ${contributor.messageCount.toLocaleString()} messages`,
            )
            .join("\n"),
          inline: false,
        },
        {
          name: "💬 Key Topics",
          value: report.keyTopics
            .slice(0, 3)
            .map((topic) => `• ${topic.topic}`)
            .join("\n"),
          inline: false,
        },
        {
          name: "📅 Next Report",
          value: `The next impact report will be generated on ${nextReportDate.format("MMMM D, YYYY")}`,
          inline: false,
        },
        {
          name: "🔗 Full Report",
          value: `[View detailed report](${process.env.PLATFORM_URL}/reports/${report.summaryId})`,
          inline: false,
        },
      )
      .setFooter({ text: `Report generated on ${dayjs(report.timestamp).format("MMMM D, YYYY")}` });

    await msg.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error fetching impact report:", error);
    await msg.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("Error")
          .setDescription(
            "Sorry, there was an error fetching the impact report. Please try again later.",
          ),
      ],
    });
  }
}
