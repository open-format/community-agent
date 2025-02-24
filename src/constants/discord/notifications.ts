export function missingRewardOpportunityEmbed(payload: any) {
  return {
    title: "Missed Reward Opportunity 🚫",
    description: `GitHub user ${payload.sender.login} has missed out on earning $DEV tokens for contributing. If this is you, [sign up](https://rewards.openformat.tech/open-format) to claim future rewards!`,
    color: 16711680, // Red color
    fields: [
      {
        name: "Repository",
        value: `[${payload.repository.full_name}](${payload.repository.html_url})`,
        inline: true,
      },
      {
        name: "Commit",
        value: `[${payload.head_commit.message.slice(0, 30)}...](${payload.head_commit.url})`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export function contributionRewardEmbed(payload: any, user: { discord: { id: string } }, hash: string) {
  return {
    title: "Contribution Reward 🤘",
    description: user?.discord?.id
      ? `<@${user.discord?.id}> pushed to ${payload.repository.name} and was rewarded 100 $DEV for their code contribution. Join <@${user.discord.id}> and others contributing to Open Format. Get started - https://rewards.openformat.tech/open-format`
      : `${payload.sender.login} pushed to ${payload.repository.name} and was rewarded 100 $DEV for their code contribution. Join ${payload.sender.login} and others contributing to Open Format. Get started - https://rewards.openformat.tech/open-format`,
    url: payload.repository.html_url,
    color: 16766464,
    fields: [
      {
        name: "Repository",
        value: `[${payload.repository.full_name}](${payload.repository.html_url})`,
        inline: true,
      },
      {
        name: "Commit",
        value: `[${payload.head_commit.message.slice(0, 30)}...](${payload.head_commit.url})`,
        inline: true,
      },
      {
        name: "Reward Information",
        value: `[View Transaction](https://sepolia.arbiscan.io/tx/${hash})`,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}
