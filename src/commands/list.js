const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { Cache, Database } = require('../ipc.js');
const { Modals } = require('../elements.js');
const itemTotal = 5;

function pagination(items, oldPage = 0, pageOffset = 0) {
    const newPage = Math.max(oldPage + pageOffset, 0);

    const startIndex = newPage * itemTotal;
    const endIndex = startIndex + itemTotal;

    const clamped = items.slice(startIndex, endIndex);
    
    return {
        clamped: clamped,
        page: newPage,
        nextPage: items.length > endIndex,
        backPage: newPage > 0
    }
}

async function createList(type, interaction, cache, pageOffset) {
    const userId = interaction.user.id;
    let items;

    if(type === 'events') {
        const unsortedEvents = await Database.getEvents(userId);
        const userEvents = unsortedEvents.sort((a, b) => a.endTime - b.endTime);
        items = {};

        for (const event of userEvents) {
            if (!items[event.type]) items[event.type] = [];

            items[event.type].push(event);
        }
    } else if(type === 'presets') {
        items = await Database.getPresets(userId);
    }

    const result = {};
    if (Array.isArray(items)) {
        const { clamped, page, nextPage, backPage } = pagination(items, cache?.page ?? 0, pageOffset);

        const lines = clamped.map(event => {
            return `• \`${event.timeString}\` [**Tag Name**: ${event.tag}]`;
        });

        return {
            data: lines,
            page,
            nextPage,
            backPage
        };
    } else {
        for (const type in items) {
            const { clamped, page, nextPage, backPage } = pagination(items[type], cache?.[type]?.page ?? 0, pageOffset);

            const lines = clamped.map(event => {
                return `• <t:${Math.floor(event.endTime / 1000)}:f> [**Event ID**: ${event.id}]`;
            });

            result[type] = {
                data: lines,
                page,
                nextPage,
                backPage
            };
        }
    }

    return result;
}

async function handlePageEvents({ type = null, client, interaction, flow = interaction.id, pageOffset = null }) {
    const cache = await Cache.getCache(flow) ?? null;
    const paged = await createList((type || cache?.type), interaction, cache, pageOffset ?? 0);
    const replied = interaction.replied || interaction.deferred;

    if(pageOffset !== null && cache === null) { // If this isn't the initial response (which doesn't have a page offset) and there's no cache available
        return interaction[replied ? 'editReply' : 'reply']({
            content: "⚠️ **Whoops!** Looks like this request expired. Please try again.",
            embeds: [],
            components: [],
            flags: MessageFlags.Ephemeral
        });
    }

    let nextPage = false;
    let backPage = false;

    const isGrouped = !('data' in paged);
    let values;

    if(isGrouped) {
        values = [];

        for (const type in paged) {
            const lines = paged[type].data;
            
            if(paged[type].nextPage) nextPage = true;
            if(paged[type].backPage) backPage = true;

            values.push({
                name: `📂 ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                value: lines.join('\n'),
                inline: false
            });
        }
    } else {
        const lines = paged.data;

        if(paged.nextPage) nextPage = true;
        if(paged.backPage) backPage = true;

        values = lines.join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(type === 'events' ? "📋 Active Events" : "📂 Saved Presets")
      .setColor(0x5865F2)
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    const buttons = new ActionRowBuilder();

    if (values.length > 0) {
        if(isGrouped) {
            embed.addFields(...values);
        } else {
            embed.setDescription(values);
        }

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`listItems+${flow}+back`)
                .setLabel("⬅ Back")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!backPage)
        );

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`listItems+${flow}+forward`)
                .setLabel("Next ➡")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!nextPage)
        );

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`viewItem+${type}`)
                .setLabel(type === 'events' ? "View Event" : "View Preset")
                .setStyle(ButtonStyle.Secondary)
        );
    } else {
        if(type === 'events') {
            embed.setDescription("⚠️ **Whoops!** It looks like you don't have any active events yet.\n\nType `/` to view the commands and create a timer, alarm, or reminder.");
        } else if(type === 'presets') {
            embed.setDescription("⚠️ **Whoops!** It looks like you don't have any presets created yet.\n\nType `/presets` to view the available commands for creating a preset.");
        }
    }

    const pages = Object.fromEntries(Object.entries(paged).map(([type, data]) => [type, { page: data.page }]));

    await Cache.setCache(flow, {
        type: type,
        ...pages
    }, (60000 * 5));

    const components = buttons.components.length > 0 ? [buttons] : [];
    await interaction[replied ? 'editReply' : 'reply']({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("View your active timers, alarms, and reminders, as well as presets.")
        .addSubcommand(subcommand => subcommand
            .setName('events')
            .setDescription('View all of your active timers, alarms, and reminders.')
        )
        .addSubcommand(subcommand => subcommand
            .setName('presets')
            .setDescription('View all of your created presets.')
        ),
  run: async (client, interaction) => {
        const type = interaction.options.getSubcommand();

        return handlePageEvents({ type, client, interaction });
  },
  async register(client) {
    client.buttons.set('listItems', async interaction => {
        const [base, flow, direction] = interaction.customId.split('+');
        const pageOffset = direction === 'forward' ? 1 : -1;
        
        return handlePageEvents({ client, interaction, flow, pageOffset });
    });
    
    client.buttons.set('viewItem', async interaction => {
        const [base, type] = interaction.customId.split('+');

        if(type === 'events') {
            return await interaction.showModal(Modals.viewEvent());
        } else if(type === 'presets') {
            return await interaction.showModal(Modals.viewPreset());
        }
    });

    client.modals.set('viewItem', async interaction => {
        const [base, type] = interaction.customId.split('+');
        let item;
        
        if(type === 'events') {
            const eventId = interaction.fields.getTextInputValue("eventId");
            item = await Database.getEvent(eventId);
        } else if(type === 'presets') {
            const tag = interaction.fields.getTextInputValue("tag");
            item = await Database.getPreset(interaction.user.id, tag);
        }

        if (!item) {
            return interaction.reply({
                content: `⚠️ **Whoops!** It looks like ${type === 'events' ? 'an event' : 'a preset'} wasn't found with this ${type === 'events' ? 'ID' : 'tag'}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(type === 'events' ? "📋 Event Details" : "📂 Preset Details")
            .setColor(0x5865F2)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

            if(type === 'events') {
                embed.addFields(
                    { name: "Type", value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
                    { name: "End Time", value: `<t:${Math.floor(item.endTime / 1000)}:f>`, inline: true },
                    { name: "Ping", value: item.ping ?? `<@${item.userId}>`, inline: true }
                );

                if (item.type === 'reminder') {
                    embed.addFields(
                        { name: "Title", value: item.title, inline: false },
                        { name: "Description", value: item.desc || "No description provided.", inline: false }
                    );
                }
            } else if(type === 'presets') {
                embed.addFields(
                    { name: "Tag", value: `\`${item.tag}\``, inline: true },
                    { name: "Duration", value: item.timeString, inline: true },
                    { name: "Ping", value: item.ping ?? `<@${interaction.user.id}>`, inline: true }
                );
            }

            const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId(`deleteItem+t_${type === 'events' ? item.id : item.tag}+${type}`)
                .setLabel(`Delete ${type === 'events' ? 'Event' : 'Preset'}`)
                .setStyle(ButtonStyle.Danger),
            );

            await interaction.reply({ embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral });
    });

    client.buttons.set('deleteItem', async interaction => {
        let [base, itemId, type] = interaction.customId.split('+');
        itemId = itemId.replace('t_', ''); // prevent checking cache
        let item;

        if(type === 'events') {
            item = await Database.getEvent(itemId);
        } else if(type === 'presets') {
            item = await Database.getPreset(interaction.user.id, itemId);
        }

        if (!item) {
            return interaction.reply({
                content: `⚠️ **Whoops!** It looks like ${type === 'events' ? 'an event' : 'a preset'} wasn't found with this ${type === 'events' ? 'ID' : 'tag'}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if(type === 'events') {
            await Database.deleteEvent(item.id);
        } else if(type === 'presets') {
            const deletion = await Database.deletePreset(interaction.user.id, itemId);

            if (deletion === null) {
                return interaction.reply({
                    content: `⚠️ **Whoops!** Something went wrong when accessing your presets.`,
                    flags: MessageFlags.Ephemeral
                });
            } else if(deletion === false) {
                return interaction.reply({
                    content: `⚠️ **Whoops!** It looks like you've already deleted this preset.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        await interaction.reply({
            content: `✅ **Success!** This ${type === 'events' ? 'event' : 'preset'} has been deleted successfully.`,
            flags: MessageFlags.Ephemeral
        });
    });
  }
};