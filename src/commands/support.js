const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ApplicationIntegrationType, InteractionContextType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("support")
    .setDescription("Need help? Join the Timer Bot support server for assistance!")
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
    const embed = new EmbedBuilder()
      .setTitle("🛠️ Need Help?")
      .setColor(0x5865F2)
      .setDescription([
        "We're here to help you with any questions, issues, or suggestions!",
        "Click the link below to join our Timer Bot support server."
      ].join("\n\n"))
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

      const main = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Join Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/xKsUXmsb8V")
      );

    await interaction.reply({ embeds: [embed], components: [main], flags: MessageFlags.Ephemeral });
  }
};