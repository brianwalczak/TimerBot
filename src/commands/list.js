const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ApplicationIntegrationType, InteractionContextType } = require("discord.js");
const { Cache, Database } = require('../ipc.js');
const { Modals } = require('../elements.js');
const itemTotal = 5;

function pagination(items, oldPage = 0, pageOffset = 0) {
    const newPage = Math.max(oldPage + pageOffset, 0);

    const startIndex = newPage * itemTotal;
    const endIndex = startIndex + itemTotal;

    const results = items.slice(startIndex, endIndex);
    
    return {
        results: results,
        page: newPage,
        hasBack: newPage > 0,
        hasNext: items.length > endIndex
    }
}

async function searchEvents({ userId, page = 0, pageOffset = 0 }) {
    const events = await Database.getEvents(userId);
    const sorted = events.sort((a, b) => a.endTime - b.endTime);

    const { results, page: newPage, hasNext, hasBack } = pagination(sorted, page, pageOffset);
    const list = results.map(event => {
        if (event.type === 'reminder') {
            return `• 📝 **Reminder**: ${event.title} on <t:${Math.floor(event.endTime / 1000)}:f>`;
        } else if (event.type === 'alarm') {
            return `• ⏰ **Alarm** for <t:${Math.floor(event.endTime / 1000)}:f>`;
        } else if (event.type === 'timer') {
            return `• ⏲️ **Timer** for \`${event.timeString}\``;
        }

        return null;
    });

    return {
        results: list,
        page: newPage,
        hasBack: hasBack,
        hasNext: hasNext
    }
}

async function searchPresets({ userId, page = 0, pageOffset = 0 }) {
    const presets = await Database.getPresets(userId);

    const { results, page: newPage, hasNext, hasBack } = pagination(presets, page, pageOffset);
    const list = results.map(event => {
        return `• 🏷️ **${event.tag}** - \`${event.timeString}\``;
    });

    return {
        results: list,
        page: newPage,
        hasBack: hasBack,
        hasNext: hasNext
    }
}

async function search(type, { userId, page = 0, pageOffset = 0 }) {
    if(type === 'events') {
        return searchEvents({ userId, page, pageOffset });
    } else if(type === 'presets') {
        return searchPresets({ userId, page, pageOffset });
    }

    return null;
}

async function handlePageEvents({ interaction, flow = interaction.id, type, page = 0, pageOffset = 0 }) {
    const replied = interaction.replied || interaction.deferred;

    const { results, page: newPage, hasBack, hasNext } = await search(type, { userId: interaction.user.id, page, pageOffset });
    const desc = results.join('\n');
    page = newPage; // just in-case!
    
    const embed = new EmbedBuilder()
        .setTitle(type === 'events' ? "📋 Active Events" : "📂 Saved Presets")
        .setColor(0x5865F2)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    if (results.length === 0) {
        if(type === 'events') {
            embed.setDescription("⚠️ **Whoops!** It looks like you don't have any active events yet.\n\nType `/` to view the commands and create a timer, alarm, or reminder.");
        } else if(type === 'presets') {
            embed.setDescription("⚠️ **Whoops!** It looks like you don't have any presets created yet.\n\nType `/presets` to view the available commands for creating a preset.");
        }

        if (interaction.isMessageComponent && interaction.isMessageComponent()) {
            return await interaction.update({ embeds: [embed], components: [] });
        }

        return await interaction[replied ? 'editReply' : 'reply']({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
    }

    const buttons = new ActionRowBuilder();

    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId(`listItems+${flow}+back`)
            .setLabel("⬅ Back")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasBack)
    );

    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId(`listItems+${flow}+forward`)
            .setLabel("Next ➡")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasNext)
    );

    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId(`viewItem+${type}`)
            .setLabel(type === 'events' ? "View Event" : "View Preset")
            .setStyle(ButtonStyle.Secondary)
    );

    embed.setDescription(desc);
    await Cache.setCache(flow, { type, page }, (60000 * 5));

    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    await interaction[replied ? 'editReply' : 'reply']({ embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral });
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
        const type = interaction.options.getSubcommand();

        return handlePageEvents({ interaction, type });
  },
  async register(client) {
    client.buttons.set('listItems', async (interaction, { type, page }) => {
        const [base, flow, direction] = interaction.customId.split('+');
        const pageOffset = direction === 'forward' ? 1 : -1;
        
        return handlePageEvents({ interaction, flow, type, page, pageOffset });
    });
    
    client.buttons.set('viewItem', async (interaction) => {
        const [base, type] = interaction.customId.split('+');

        if(type === 'events') {
            return await interaction.showModal(Modals.viewEvent());
        } else if(type === 'presets') {
            return await interaction.showModal(Modals.viewPreset());
        }
    });

    client.modals.set('viewItem', async (interaction) => {
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

    client.buttons.set('deleteItem', async (interaction) => {
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