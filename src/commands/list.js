const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ApplicationIntegrationType, InteractionContextType } = require("discord.js");
const { Cache, Database } = require('../ipc.js');
const { createDateTimeString } = require('../utils.js');
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

async function searchEvents({ userId, tz = 'UTC', page = 0, pageOffset = 0 }) {
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

    const options = results.map(event => {
        let label;
        let description;

        if (event.type === 'reminder') {
            label = `📝 Reminder: ${event.title}`;
            description = createDateTimeString(event.endTime, tz);
        } else if (event.type === 'alarm') {
            label = '⏰ Alarm';
            description = createDateTimeString(event.endTime, tz);
        } else if (event.type === 'timer') {
            label = '⏱️ Timer';
            description = 'Duration: ' + event.timeString;
        }

        // 100 char limit :[
        return new StringSelectMenuOptionBuilder()
            .setLabel(label.slice(0, 100))
            .setValue(event.id)
            .setDescription(description.slice(0, 100));
    });

    return {
        results: list,
        options: options,
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

    // 100 char limit :[
    const options = results.map(preset => new StringSelectMenuOptionBuilder()
        .setLabel('🏷️ ' + preset.tag.slice(0, 80))
        .setValue(preset.tag)
        .setDescription(`Duration: ${preset.timeString}`.slice(0, 100))
    );

    return {
        results: list,
        options: options,
        page: newPage,
        hasBack: hasBack,
        hasNext: hasNext
    }
}

async function search(type, { userId, tz = 'UTC', page = 0, pageOffset = 0 }) {
    if(type === 'events') {
        return searchEvents({ userId, tz, page, pageOffset });
    } else if(type === 'presets') {
        return searchPresets({ userId, page, pageOffset });
    }

    return null;
}

async function handlePageEvents({ interaction, flow = interaction.id, type, page = 0, pageOffset = 0 }) {
    const replied = interaction.replied || interaction.deferred;
    const user = await Database.getUser(interaction.user.id);
    const tz = user?.timezone || 'UTC';

    const { results, options, page: newPage, hasBack, hasNext } = await search(type, { userId: interaction.user.id, tz, page, pageOffset });
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
            return await interaction.update({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
        }

        return await interaction[replied ? 'editReply' : 'reply']({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
    }

    const components = [];
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

    components.push(buttons);

    if (options.length > 0) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`selectItem+${flow}+${type}`)
                .setPlaceholder(type === 'events' ? 'Select an event to view' : 'Select a preset to view')
                .addOptions(options)
        ));
    }

    embed.setDescription(desc);
    await Cache.setCache(flow, { userId: interaction.user.id, type, page }, (60000 * 5));

    if (interaction.isMessageComponent && interaction.isMessageComponent()) {
        return await interaction.update({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    }

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
    
    client.menus.set('selectItem', async (interaction) => {
        const [base, flow, type] = interaction.customId.split('+');
        let item;
        const user = await Database.getUser(interaction.user.id);
        const tz = user?.timezone || 'UTC';
        const selectedValue = interaction.values[0];
        
        if(type === 'events') {
            item = await Database.getEvent(selectedValue);
        } else if(type === 'presets') {
            item = await Database.getPreset(interaction.user.id, selectedValue);
        }

        if (!item) {
            return interaction.reply({
                content: `⚠️ **Whoops!** It looks like ${type === 'events' ? 'an event' : 'a preset'} no longer exists.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (type === 'events' && item.userId !== interaction.user.id) {
            return interaction.reply({
                content: `⚠️ **Whoops!** You do not have permission to view this event.`,
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
                .setCustomId(`deleteItem+${flow}+t_${type === 'events' ? item.id : item.tag}+${type}`)
                .setLabel(`Delete ${type === 'events' ? 'Event' : 'Preset'}`)
                .setStyle(ButtonStyle.Danger),
            );

            await interaction.reply({ embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral });
    });

    client.buttons.set('deleteItem', async (interaction) => {
        let [base, flow, itemId, type] = interaction.customId.split('+');
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

        if (type === 'events' && item.userId !== interaction.user.id) {
            return interaction.reply({
                content: `⚠️ **Whoops!** You do not have permission to delete this event.`,
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