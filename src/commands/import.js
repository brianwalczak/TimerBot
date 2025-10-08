const { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require("discord.js");
const { RateLimiter, Database } = require('../ipc.js');
const { ulid } = require('ulid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("import")
    .setDescription("Import your upcoming events from a .json file (supports multiple events).")
    .addAttachmentOption(option =>
      option.setName('file')
            .setDescription('Upload your exported JSON file')
            .setRequired(true)
    )
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
    const attachment = interaction.options.getAttachment('file');
    
    if (!attachment.name.endsWith('.json')) {
        return interaction.reply({
            content: `⚠️ **Whoops!** It looks like the file you uploaded is not a valid JSON file.`,
            flags: MessageFlags.Ephemeral
        });
    }

    const events = await fetch(attachment.url).then(res => res.json()).catch(() => null);
    if (!events) {
        return interaction.reply({
            content: `⚠️ **Whoops!** It looks like the file you uploaded doesn't follow the expected format.`,
            flags: MessageFlags.Ephemeral
        });
    } else if(events.length === 0) {
        return interaction.reply({
            content: "⚠️ **Whoops!** It looks like the file you uploaded doesn't contain any events.",
            flags: MessageFlags.Ephemeral
        });
    } else {
      // check if their import will exceed their event quota
      const remainingQuota = await RateLimiter.remainingQuota(interaction.user.id);

      if (events.length > remainingQuota) {
        return interaction.reply({
            content: `⚠️ **Whoops!** It looks like you have reached your event limit. You can only have ${remainingQuota} more scheduled events (${events.length} found in your file).`,
            flags: MessageFlags.Ephemeral
        });
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let success = 0;
    for (const event of events) {
      if((!event.channelId && !event.userId) || !event.endTime || !event.type) continue;
      if(event.type === 'timer' && !event.timeString) continue;
      if(event.type === 'reminder' && !event.title) continue;

      // check if channel ID or user ID is valid (generally id's are around 19 digits, but we're adding a range for safety, also to prevent huge numbers)
      if ((event.channelId && !/^\d{15,25}$/.test(event.channelId)) || (event.userId && !/^\d{15,25}$/.test(event.userId))) continue;
      // check if end time is a valid epoch and is in the future
      if (isNaN(event.endTime) || event.endTime <= Date.now()) continue;
      // check if type is valid (timer, alarm, reminder)
      if (!['timer', 'alarm', 'reminder'].includes(event.type)) continue;
      // check if the title is a string and <= 100 characters
      if (event.type === 'reminder' && (typeof event.title !== 'string' || event.title.length > 100)) continue;
      // check if the description exists, if it does check if it's a string and <= 750 characters
      if (event.type === 'reminder' && event.desc && (typeof event.desc !== 'string' || event.desc.length > 750)) continue;

      await Database.insertEvent({
        channelId: event?.channelId ?? null,
        id: ulid(),
        endTime: event.endTime,
        ...(event.type === 'timer' ? { timeString: event.timeString } : {}),
        ping: event.ping ?? null,
        ...(event.type === 'reminder' ? { title: event.title } : {}),
        ...(event.type === 'reminder' && event.desc ? { desc: event.desc } : {}),
        userId: interaction.user.id,
        type: event.type
      });

      success++;
    }

    if (success === 0) {
      return interaction.editReply({
        content: "⚠️ **Whoops!** It looks like there were no valid events in your file to import."
      });
    } else {
      return interaction.editReply({
        content: `✅ Successfully imported ${success === events.length ? "all" : success} event${success === 1 ? "" : "s"} from your JSON file!`
      });
    }
  }
};