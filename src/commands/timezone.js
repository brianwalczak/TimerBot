const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { Database } = require('../ipc.js');
const timezone = require('../timezone.json');
const { IANAZone } = require("luxon");

async function setZone(interaction) {
  const replied = interaction.replied || interaction.deferred;

  if(!IANAZone.isValidZone(interaction.values[0])) {
    return interaction[replied ? 'editReply' : 'reply']({
      content: '❌ **Whoops!** An invalid time zone was selected. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }

  await Database.setUserTimezone(interaction.user.id, interaction.values[0]);
  await interaction[replied ? 'editReply' : 'reply']({
    content: `Your time zone has been successfully updated to \`${interaction.values[0]}\`.\nAll future alarms and reminders will use this time zone when a date is specified.`,
    components: [],
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timezone')
    .setDescription('Set your time zone for alarms and reminders (required for accurate pings).')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel
    ]),
  async run(client, interaction) {
    let currentZone = 'None';
    const user = await Database.getUser(interaction.user.id);

    if(user && user.timezone) {
      currentZone = user.timezone;
    }

    const lists = Object.entries(timezone).map(([region, options]) =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectTimezone_${region.replace(/[^a-z]/gi, '')}`)
          .setPlaceholder(region)
          .addOptions(options.map(opt =>
            new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
          ))
      )
    );

    await interaction.reply({
      content: `🌍 Please select your time zone below (you only need to select one option).\nCurrent Selection: **${currentZone}**`,
      components: lists,
      flags: MessageFlags.Ephemeral // no need to cache user id
    });
  },
  async register(client) {
    for (const region of Object.keys(timezone)) {
      client.menus.set(`selectTimezone_${region.replace(/[^a-z]/gi, '')}`, setZone);
    }
  }
};