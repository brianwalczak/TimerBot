const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { Database } = require('../ipc.js');
const ics = require('ics');

function epochToArr(epoch) {
    const date = new Date(epoch);
    return [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
    ];
}

async function generateICS(input) {
    const events = (Array.isArray(input) ? input : [input]).map(event => ({
        title: event.title,
        description: event.description,
        start: epochToArr(event.startTime || event.endTime), // in case more features come soon!
        end: epochToArr(event.endTime),
        status: 'CONFIRMED',
        created: epochToArr(Date.now()),
        lastModified: epochToArr(Date.now()),
        startInputType: 'utc',
        startOutputType: 'utc',
        endInputType: 'utc',
        endOutputType: 'utc'
    }));

    let result;
    if (events.length > 1) {
        result = await ics.createEvents(events);
    } else {
        result = await ics.createEvent(events[0]);
    }

    return result.error ? null : result.value;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export all of your upcoming events as a .json or .ics file (compatible with Google/Apple Calendar).")
    .addStringOption(option =>
        option.setName('format')
            .setDescription('Choose export format')
            .setRequired(true)
            .addChoices(
                { name: 'JSON', value: 'json' },
                { name: 'ICS', value: 'ics' }
            )
    ),
  run: async (client, interaction) => {
    const format = interaction.options.getString('format');
    const userEvents = await Database.getEvents(interaction.user.id);

    if(!userEvents || userEvents.length === 0) {
        return interaction.reply({
            content: "⚠️ **Whoops!** It looks like you don't have any upcoming events available for export.",
            flags: MessageFlags.Ephemeral
        });
    }

    let data;
    if(format === 'json') {
        data = JSON.stringify(userEvents.map(event => ({
            channelId: event.channelId,
            userId: event.userId,
            ...(event.title && { title: event.title }),
            ...(event.desc && { desc: event.desc }),
            endTime: event.endTime,
            ...(event.timeString && { timeString: event.timeString }),
            ping: event.ping ?? null,
            type: event.type
        })), null, 2);
    } else if(format === 'ics') {
        const events = userEvents.map(event => ({
            title: event.title ?? 'Untitled Event',
            description: event.desc ?? 'No description provided.',
            endTime: event.endTime
        }));

        data = await generateICS(events);
    }

    return interaction.reply({
        content: "✅ Your active events have been successfully exported. You can download them below.",
        files: [{
            attachment: Buffer.from(data, 'utf-8'),
            name: (format === 'json' ? 'events.json' : 'events.ics'),
            contentType: (format === 'json' ? 'application/json' : 'text/calendar')
        }],
        flags: MessageFlags.Ephemeral
    });
  },
  async register(client) {
    client.buttons.set('ics', async interaction => { // individual exports
        let [base, eventId] = interaction.customId.split('+');
        const replied = interaction.replied || interaction.deferred;
        eventId = eventId.replace('e_', ''); // prevent checking cache

        const event = await Database.getEvent(eventId);
        if(!event) {
            return interaction.reply({
				content: "⚠️ **Whoops!** Looks like this event has already ended and no longer exists.",
				flags: MessageFlags.Ephemeral
			});
        }

        const data = await generateICS({
            title: event.title ?? 'Untitled Event',
            description: event.desc ?? 'No description provided.',
            endTime: event.endTime
        })
        if(!data) {
            return interaction.reply({
				content: "⚠️ **Whoops!** Looks like an error occurred while generating the `.ics` file. Please try again.",
				flags: MessageFlags.Ephemeral
			});
        }

        return interaction[replied ? 'editReply' : 'reply']({
            content: "✅ Your calendar event has been successfully generated. You can download it below.",
            files: [{
                attachment: Buffer.from(data, 'utf-8'),
                name: 'event.ics',
                contentType: 'text/calendar'
            }],
            flags: MessageFlags.Ephemeral
        });
    });
  }
};