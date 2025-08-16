const { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require('discord.js');
const { Modals, Embeds } = require('../elements.js');
const { getMsDuration, createTimeString } = require('../utils.js');
const { Cache, Database } = require('../ipc.js');
const { ulid } = require("ulid");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timer')
    .setDescription('Set a custom timer with hours, minutes, and seconds. You will be notified when the timer ends.')
		.addStringOption(option =>
			option.setName('ping')
			.setDescription("Enter a user or role to ping when the timer ends. If none is entered, only you will be notified.")
			.setRequired(false))
		.addChannelOption(option =>
            option.setName('channel')
            .setDescription('Select a custom channel to send the alert. If none is selected, it will be sent in this channel.')
            .setRequired(false))
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
	const channel = interaction.options.getChannel('channel');
	const flow = interaction.id;
	const modal = Modals.timer(flow);
	await interaction.showModal(modal);

	await Cache.setCache(flow, {
		ping: interaction.options.getString("ping") ?? null,
		userId: interaction.user.id, // must keep (prevents other users from tampering with the flow)
		channelId: channel?.id ?? interaction?.channel?.id ?? null
	}, (60000 * 5));
  },
  async register(client) {
	client.modals.set('timerModal', async interaction => {
		const [base, flow] = interaction.customId.split('+');

		const hours = parseInt(interaction.fields.getTextInputValue("hours")) || 0;
		const minutes = parseInt(interaction.fields.getTextInputValue("minutes")) || 0;
		const seconds = parseInt(interaction.fields.getTextInputValue("seconds")) || 0;

		const totalMs = getMsDuration({ hours, minutes, seconds });
		if (totalMs <= 0) {
			return interaction.reply({
				content: "❌ Your timer must be longer than 0 seconds. Please ensure you entered a valid time.",
				flags: MessageFlags.Ephemeral
			});
		} else if(totalMs > 86400000) {
			return interaction.reply({
				content: "❌ Your timer cannot be longer than 24 hours. Please ensure you entered a valid time.",
				flags: MessageFlags.Ephemeral
			});
		}

		if (!(await Cache.isCache(flow))) {
			return interaction.reply({
				content: "⚠️ **Whoops!** Looks like this timer request expired. Please try again.",
				flags: MessageFlags.Ephemeral
			});
		}

		const { ping, channelId } = await Cache.getCache(flow);

		const cacheData = {
			timeString: createTimeString({ hours, minutes, seconds }),
			totalMs,
			ping,
			channelId,
			userId: interaction.user.id,
			type: 'timer'
		};

		const { embed, components } = Embeds.event({ type: 'timer', flow, user: interaction.user, data: cacheData });
		embed.setTitle("⏱️ Confirm Timer");

		await Cache.setCache(flow, cacheData, (60000 * 5));

		await interaction.reply({
		  embeds: [embed],
		  components
		});
	});

	client.buttons.set('timerConfirm', async interaction => {
		const [base, flow] = interaction.customId.split('+');
		const replied = interaction.replied || interaction.deferred;

		if (!(await Cache.isCache(flow))) {
			return interaction[replied ? 'editReply' : 'reply']({
				content: "⚠️ **Whoops!** Looks like this timer request expired. Please try again.",
				embeds: [],
				components: [],
				flags: MessageFlags.Ephemeral
			});
		}

		const cacheData = await Cache.getCache(flow);
		const eventId = ulid();
		const { embed, components } = Embeds.event({ type: 'timer', user: interaction.user, data: cacheData, eventId });
		const endTime = (Date.now() + cacheData.totalMs);
		await Cache.clearCache(flow);

		delete cacheData.expiresAt;
		delete cacheData.totalMs;
		await Database.insertEvent({
			id: eventId,
			endTime: endTime,
			...cacheData
		});

		embed.setTitle("✅ Timer Confirmed");
		embed.setDescription(`Your timer is currently running and will end <t:${Math.floor(endTime / 1000)}:R>.`);
		await interaction[replied ? 'editReply' : 'reply']({
			embeds: [embed],
			components: components
		});
	});

	client.buttons.set('timerCancel', async interaction => {
		const [base, flow] = interaction.customId.split('+');

		await interaction.deferUpdate();

		await Cache.clearCache(flow);
		await interaction.deleteReply();
	});
  }
};