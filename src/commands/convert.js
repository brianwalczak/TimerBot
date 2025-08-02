const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const { Modals } = require('../elements.js');
const { Database, Cache } = require('../ipc.js');
const timezone = require('../timezone.json');
const { IANAZone, DateTime } = require("luxon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert a specified time to your local time zone.'),

  async run(client, interaction) {
    const user = await Database.getUser(interaction.user.id);
    if(!user || !user.timezone) return interaction.reply({
        content: "⚠️ **Whoops!** Looks like you haven't set your timezone yet. Please use the `/timezone` command to set it before using this command.",
        flags: MessageFlags.Ephemeral
    });

    const lists = Object.entries(timezone).map(([region, options]) =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`convert_${region.replace(/[^a-z]/gi, '')}`)
          .setPlaceholder(region)
          .addOptions(options.map(opt =>
            new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
          ))
      )
    );

    await interaction.reply({
      content: `🌍 Please select the time zone below to convert **from** (you only need to select one option).`,
      components: lists,
      flags: MessageFlags.Ephemeral
    });
  },
  async register(client) {
    for (const region of Object.keys(timezone)) {
      client.menus.set(`convert_${region.replace(/[^a-z]/gi, '')}`, async interaction => {
        const replied = interaction.replied || interaction.deferred;

        if(!IANAZone.isValidZone(interaction.values[0])) {
            return interaction[replied ? 'editReply' : 'reply']({
                content: '⚠️ **Whoops!** An invalid time zone was selected. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }

        const flow = interaction.id;
        await Cache.setCache(flow, { tz: interaction.values[0] }, (60000 * 5));
        await interaction.showModal(Modals.convert(flow));
      });
    }

    client.modals.set('convert', async interaction => {
        const date = interaction.fields.getTextInputValue("date");
        const time = interaction.fields.getTextInputValue("time");
        const [base, flow] = interaction.customId.split('+');
        const replied = interaction.replied || interaction.deferred;

        if (!(await Cache.isCache(flow))) {
            return interaction[replied ? 'editReply' : 'reply']({
                content: `⚠️ **Whoops!** Looks like this timezone conversion request expired. Please try again.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const user = await Database.getUser(interaction.user.id);
        if(!user || !user.timezone) return interaction[replied ? 'editReply' : 'reply']({
            content: "⚠️ **Whoops!** Looks like you haven't set your timezone yet. Please use the `/timezone` command to set it before using this command.",
            flags: MessageFlags.Ephemeral
        });

        const { tz } = await Cache.getCache(flow);
        const [month, day, year] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        
        const localDate = DateTime.fromObject({ year, month, day, hour, minute }, { zone: tz });
        if (!localDate.isValid) {
            return interaction[replied ? 'editReply' : 'reply']({
                content: "⚠️ **Whoops!** Please ensure you entered a valid date in the format MM-DD-YYYY and a valid time in the format HH:MM (24-hour format).",
                flags: MessageFlags.Ephemeral
            });
        }

        const userDate = localDate.setZone(user.timezone);
        const formattedDate = userDate.toFormat('MM-dd-yyyy');
        const formattedTime = userDate.toFormat('HH:mm');

        await Cache.clearCache(flow);
        await interaction[replied ? 'editReply' : 'reply']({
            content: `✅ **Success!** The converted time is ${formattedDate} at ${formattedTime} in your local time zone.`,
            flags: MessageFlags.Ephemeral
        });
    });
  }
};