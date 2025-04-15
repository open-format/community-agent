import { EmbedBuilder } from "discord.js";

export interface TopContributor {
  username: string;
  messageCount: number;
}

export interface ChannelBreakdown {
  channelName: string;
  messageCount: number;
  uniqueUsers: number;
}

export interface KeyTopic {
  topic: string;
  messageCount: number;
  description: string;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  uniqueUsers: number;
}

export interface Sentiment {
  title: string;
  description: string;
  users: string[];
}

export interface ReportData {
  summaryId: string;
  timestamp: number;
  overview: {
    totalMessages: number;
    uniqueUsers: number;
    activeChannels: number;
  };
  topContributors: TopContributor[];
  channelBreakdown: ChannelBreakdown[];
  keyTopics: KeyTopic[];
  dailyActivity: DailyActivity[];
  userSentiment: {
    excitement: Sentiment[];
    frustrations: Sentiment[];
  };
}

export function createReportEmbeds(report: ReportData) {
  const overview = report.overview;

  const mainEmbed = new EmbedBuilder()
    .setTitle("📊 Community Impact Report")
    .setDescription(
      `Here's your community activity report for the last 30 days.\n\n**📈 Quick Stats**\n• Total Messages: ${overview.totalMessages}\n• Unique Users: ${overview.uniqueUsers}\n• Active Channels: ${overview.activeChannels}`,
    )
    .setColor(0x00ff00)
    .addFields([
      {
        name: "👥 Top Contributors",
        value: report.topContributors
          .slice(0, 5)
          .map((c: TopContributor, i: number) => {
            const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
            return `${medals[i]} ${c.username}: ${c.messageCount} messages`;
          })
          .join("\n"),
        inline: true,
      },
      {
        name: "📝 Most Active Channels",
        value: report.channelBreakdown
          .slice(0, 5)
          .map(
            (c: ChannelBreakdown) =>
              `• ${c.channelName}: ${c.messageCount} messages (${c.uniqueUsers} users)`,
          )
          .join("\n"),
        inline: false,
      },
      {
        name: "🔍 Key Discussion Topics",
        value: report.keyTopics
          .slice(0, 3)
          .map((t: KeyTopic) => `**${t.topic}** (${t.messageCount} messages)\n${t.description}`)
          .join("\n\n"),
        inline: false,
      },
      {
        name: "🎉 Community Highlights",
        value: report.userSentiment.excitement
          .slice(0, 3)
          .map((highlight: Sentiment) => `• **${highlight.title}**: ${highlight.description}`)
          .join("\n"),
        inline: false,
      },
    ])
    .setTimestamp();

  const activityEmbed = new EmbedBuilder()
    .setTitle("📈 Daily Activity Breakdown")
    .setDescription(
      report.dailyActivity
        .map(
          (day: DailyActivity) =>
            `**${day.date}**: ${day.messageCount} messages (${day.uniqueUsers} users)`,
        )
        .join("\n"),
    )
    .setColor(0x0099ff)
    .setFooter({ text: "Activity trends over the last 30 days" });

  const embeds = [mainEmbed.toJSON(), activityEmbed.toJSON()];

  if (report.userSentiment.frustrations && report.userSentiment.frustrations.length > 0) {
    const challengesEmbed = new EmbedBuilder()
      .setTitle("🔧 Areas for Improvement")
      .setDescription("Issues identified from community feedback:")
      .addFields([
        {
          name: "Community Challenges",
          value: report.userSentiment.frustrations
            .map((f: Sentiment) => `• **${f.title}**: ${f.description}`)
            .join("\n"),
        },
      ])
      .setColor(0xffa500);

    embeds.push(challengesEmbed.toJSON());
  }

  return embeds;
}
