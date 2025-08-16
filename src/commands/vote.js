const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require("discord.js");

const websites = [
  {
    name: "Top.gg",
    url: "https://top.gg/bot/759432068651548705"
  },
  {
    name: "DiscordBotList",
    url: "https://discordbotlist.com/bots/timer-bot"
  }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Support Timer Bot by voting on these platforms!")
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel
    ]),
  run: async (client, interaction) => {
    const fields = websites.map(site => ({
      name: `🌐 ${site.name}`,
      value: `[Vote here](${site.url})`,
      inline: true
    }));

    const embed = new EmbedBuilder()
      .setTitle("🗳️ Vote for Timer Bot")
      .setColor(0x5865F2)
      .addFields(...fields)
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp()
      .setDescription("Thanks for your support! If you found Timer Bot useful to you, please consider voting for me on the following platforms.\n\nPlease note that you can only vote once every day on each platform 🙌");

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
