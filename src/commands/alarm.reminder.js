const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Cache, Database } = require('../ipc.js');
const { DateTime } = require("luxon");
const { Modals, Embeds } = require('../elements.js');
const { ulid } = require("ulid");

function createDate(date, time, tz) {
  try {
    const [month, day, year] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    const localDate = DateTime.fromObject({ year, month, day, hour, minute }, { zone: tz });

    if (!localDate.isValid) return null;
    return localDate.toUTC().toMillis();
  } catch (error) {
    return null;
  }
}

function cmdHandler(type) {
    return {
        data: new SlashCommandBuilder()
            .setName(type)
            .setDescription(type === 'reminder' ? 'Set a custom reminder w/ details for a date and time. You will be notified when the reminder is due.' : 'Set a custom alarm for a specific date and time. You will be notified when the alarm ends.')
                .addStringOption(option =>
                    option.setName('ping')
                    .setDescription(`Enter a user or role to ping when the ${type} ends. If none is entered, only you will be notified.`)
                    .setRequired(false)),
        async run(client, interaction) {
            const user = await Database.getUser(interaction.user.id);
            if(!user || !user.timezone) return interaction.reply({
                content: "⚠️ **Whoops!** Looks like you haven't set your timezone yet. Please use the `/timezone` command to set it before using this command.",
                flags: MessageFlags.Ephemeral
            });

            const flow = interaction.id;
            const modal = Modals[type](flow);
            await interaction.showModal(modal);

            await Cache.setCache(flow, {
                ping: interaction.options.getString("ping") ?? null,
                userId: interaction.user.id,
                tz: user.timezone // include user timezone in cache
            }, (60000 * 5));
        },
        async register(client) {
            client.modals.set(`${type}Modal`, async interaction => {
                const [base, flow] = interaction.customId.split('+');

                const date = interaction.fields.getTextInputValue("date");
                const time = interaction.fields.getTextInputValue("time");
                let title = null, desc = null;

                if(type === 'reminder') {
                    title = interaction.fields.getTextInputValue("title");
                    desc = interaction.fields.getTextInputValue("description");
                };

                if (!(await Cache.isCache(flow))) {
                    return interaction.reply({
                        content: `⚠️ **Whoops!** Looks like this ${type} request expired. Please try again.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                const { ping, tz } = await Cache.getCache(flow);
                const endTime = createDate(date, time, tz);

                if (!endTime || endTime <= Date.now()) {
                    return interaction.reply({
                        content: `❌ Your ${type} must be set for a valid date and time.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const cacheData = {
                    endTime,
                    ping,
                    tz,
                    ...(type === 'reminder' ? { title, desc } : {}),
                    userId: interaction.user.id,
                    type: type
                };

                const { embed, components } = Embeds.event({ type: type, flow, user: interaction.user, data: cacheData });
                embed.setTitle(type === 'reminder' ? "📝 Confirm Reminder" : "⏰ Confirm Alarm");

                await Cache.setCache(flow, cacheData, (60000 * 5));

                await interaction.reply({
                    embeds: [embed],
                    components
                });
            });

            client.buttons.set(`${type}Confirm`, async interaction => {
                const [base, flow] = interaction.customId.split('+');
                const replied = interaction.replied || interaction.deferred;
                
                if (!(await Cache.isCache(flow))) {
                    return interaction[replied ? 'editReply' : 'reply']({
                        content: `⚠️ **Whoops!** Looks like this ${type} request expired. Please try again.`,
                        embeds: [],
                        components: [],
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                const cacheData = await Cache.getCache(flow);
                const { embed } = Embeds.event({ type, user: interaction.user, data: cacheData });
                await Cache.clearCache(flow);

                delete cacheData.expiresAt;
                delete cacheData.tz;

                await Database.insertEvent({
                    channelId: interaction?.channel?.id ?? null,
                    id: ulid(),
                    ...cacheData
                });

                embed.setTitle(`✅ ${type === 'reminder' ? "Reminder" : "Alarm"} Confirmed`);
                embed.setDescription(type === 'reminder' ? `Your reminder has been successfully saved and you will be notified <t:${Math.floor(cacheData.endTime / 1000)}:R>.` : `Your alarm is currently running and will end <t:${Math.floor(cacheData.endTime / 1000)}:R>.`);

                await interaction[replied ? 'editReply' : 'reply']({
                    embeds: [embed],
                    components: []
                });
            });

            client.buttons.set(`${type}Cancel`, async interaction => {
                const [base, flow] = interaction.customId.split('+');

                await interaction.deferUpdate();

                await Cache.clearCache(flow);
                await interaction.deleteReply();
            });
        }
    }
};

module.exports = [cmdHandler('alarm'), cmdHandler('reminder')];