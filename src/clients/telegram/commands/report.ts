import { vectorStore } from "@/agent/stores/vectorStore";
import { ReportData } from "@/clients/common/formatters/report";
import dayjs from "dayjs";

export async function getReport(chatId: string): Promise<string> {

  const results: { metadata: ReportData; score: number }[] = await vectorStore.query({
    indexName: "impact_reports",
    queryVector: new Array(1536).fill(0),
    topK: 100,
    includeMetadata: true,
    filter: {
      platformId: chatId,
    },
  });

  if (results.length === 0) {
    return `
*No Impact Report Available*

There are no impact reports available for this community yet

*Next Report*

Impact reports are generated every week. The next report will be available soon
`;
  }
  const report = results.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)[0].metadata;
  const nextReportDate = dayjs(report.timestamp).add(7, "days");


  // REPORT:
  return `*Community Impact Report*
  
_Latest insights from your community's activity_

*📊 Overview*

• ${report.overview.totalMessages.toLocaleString()} total messages
• ${report.overview.uniqueUsers.toLocaleString()} unique participants
• ${report.overview.activeChannels} active channels

*🏆 Top Contributors*

${report.topContributors
  .slice(0, 3)
  .map(
    (contributor) =>
      `• ${escapeMarkdownV2(contributor.username)}: ${contributor.messageCount.toLocaleString()} messages`,
  )
  .join("\n")}

*💬 Key Topics*

${report.keyTopics
  .slice(0, 3)
  .map((topic) => `• ${escapeMarkdownV2(topic.topic)}`)
  .join("\n")}

*📅 Next Report*

The next impact report will be generated on ${nextReportDate.format("MMMM D, YYYY")}

*🔗 Full Report*

[View detailed report](${process.env.PLATFORM_URL}/reports/${report.summaryId})

_Report generated on ${dayjs(report.timestamp).format("MMMM D, YYYY")}_
`;
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (char) => '\\' + char);
}