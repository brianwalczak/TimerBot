const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View a list of all commands and what they do.")
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
      .setTitle("🛠️ Timer Bot | Help")
      .setColor(0x5865F2)
      .setDescription("To use a command, type `/` followed by one of the commands below:")
      .addFields(
        { name: "/timer", value: "Set a custom timer with hours, minutes, and seconds.", inline: false },
        { name: "/alarm", value: "Set an alarm that goes off at a specific date and time.", inline: false },
        { name: "/reminder", value: "Set a detailed reminder with a title and description.", inline: false },
        { name: "/presets create", value: "Create a reusable timer preset for future use.", inline: false },
        { name: "/presets run", value: "Run a previously saved preset by its custom tag.", inline: false },
        { name: "/list events", value: "View all active timers, alarms, and reminders.", inline: false },
        { name: "/list presets", value: "View all saved timer presets.", inline: false },
        { name: "/import", value : "Import multiple events from a .json file at once.", inline: false },
        { name: "/export", value: "Export all of your upcoming events as a .json or .ics file.", inline: false },
        { name: "/convert", value: "Convert a date and time to your local time zone.", inline: false },
        { name: "/timezone", value: "Set your time zone for accurate reminders and alarms.", inline: false },
        { name: "/status", value: "Check the bot's uptime, memory usage, and server count.", inline: false },
        { name: "/vote", value: "Support Timer Bot by voting on Top.gg and others!", inline: false },
        { name: "/support", value: "Join the Timer Bot support server for help.", inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};