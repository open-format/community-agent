import { vectorStore } from "@/agent/stores/vectorStore";
import type { ReportData } from "@/clients/common/formatters/report";
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
    return escapeMarkdownV2(`
*No Impact Report Available*

There are no impact reports available for this community yet

*Next Report*

Impact reports are generated every day. The next report will be available soon
`);
  }

  const report = results.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)[0].metadata;
  const nextReportDate = dayjs(report.timestamp).add(7, "days");

  // REPORT:
  return `*Community Impact Report*
  
_Latest insights from your community's activity_

*📊 Overview*

• ${escapeMarkdownV2(report.overview.totalMessages.toLocaleString())} total messages
• ${escapeMarkdownV2(report.overview.uniqueUsers.toLocaleString())} unique participants
• ${escapeMarkdownV2(report.overview.activeChannels.toLocaleString())} active channels

*🏆 Top Contributors*

${report.topContributors
  .slice(0, 3)
  .map(
    (contributor) =>
      `• ${escapeMarkdownV2(contributor.username)}: ${escapeMarkdownV2(contributor.messageCount.toLocaleString())} messages`,
  )
  .join("\n")}

*💬 Key Topics*

${report.keyTopics
  .slice(0, 3)
  .map((topic) => `• ${escapeMarkdownV2(topic.topic)}`)
  .join("\n")}

*📅 Next Report*

The next impact report will be generated on ${escapeMarkdownV2(nextReportDate.format("MMMM D, YYYY"))}

*🔗 Full Report*

[View detailed report](${process.env.PLATFORM_URL}/reports/${report.summaryId})

_Report generated on ${escapeMarkdownV2(dayjs(report.timestamp).format("MMMM D, YYYY"))}_
`;
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (char) => "\\" + char);
}
