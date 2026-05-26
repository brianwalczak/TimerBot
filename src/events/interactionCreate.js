const { InteractionType, MessageFlags } = require("discord.js");
const { RateLimiter, Cache } = require('../ipc.js');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		const replied = interaction.replied || interaction.deferred;
		if (interaction.user.bot) return;

		async function validateFlow(flow) {
			if (flow != null && !isNaN(flow)) { // If flow is a number, it is a cache ID
				const cache = await Cache.getCache(flow);

				// Expired session!
				if (!cache) {
					await interaction[replied ? 'followUp' : 'reply']({
						content: "⚠️ **Whoops!** Looks like your request expired. Please try running this command again.",
						flags: MessageFlags.Ephemeral
					});

					return { success: false, cache: null };
				}

				// User ID mismatch!
				if (cache.userId != null && cache.userId.toString() !== interaction.user.id.toString()) {
					return { success: false, cache: cache }; // silent failure, somebody is hijacking somebody else's interaction xD
				}

				return { success: true, cache: cache };
			}

			return { success: true, cache: null };
		}

		// Handle buttons when provided (if handler exists)
		if (interaction.isButton()) {
			const [base, flow] = interaction.customId.split('+');
			const handler = interaction.client.buttons.get(base);
			if (handler) {
				try {
					const validate = await validateFlow(flow);
					if (!validate.success) return;

					await handler(interaction, validate.cache);
				} catch (err) {
					console.error('[ERROR] An error occurred while handling a button: ', err);
					
					return interaction.reply({
						content: "❌ There was an error when processing your button confirmation.",
						flags: MessageFlags.Ephemeral
					});
				}
			}

			return;
		}

		// Handle modals when provided (if handler exists)
		if (interaction.type === InteractionType.ModalSubmit) {
			const [base, flow] = interaction.customId.split('+');
			const handler = interaction.client.modals.get(base);
			if (handler) {
				try {
					const validate = await validateFlow(flow);
					if (!validate.success) return;

					await handler(interaction, validate.cache);
				} catch (err) {
					console.error('[ERROR] An error occurred while handling a modal: ', err);

					return interaction.reply({
						content: "❌ There was an error when processing your form.",
						flags: MessageFlags.Ephemeral
					});
				}
			}

			return;
		}
		
		if (interaction.isStringSelectMenu()) {
			const [base, flow] = interaction.customId.split('+');
			const handler = interaction.client.menus.get(base);
			if (handler) {
				try {
					const validate = await validateFlow(flow);
					if (!validate.success) return;

					await handler(interaction, validate.cache);
				} catch (err) {
					console.error('[ERROR] An error occurred while handling a select menu: ', err);

					return interaction.reply({
						content: "❌ There was an error when processing your selection.",
						flags: MessageFlags.Ephemeral
					});
				}
			}
			
			return;
		}

		if (interaction.type !== InteractionType.ApplicationCommand) return;

		const commandName = interaction.commandName.toLowerCase();
		const subCommandName = interaction.options.getSubcommand(false)?.toLowerCase();
		const userLimited = await RateLimiter.checkUserLimits(interaction.user.id, `${commandName}${subCommandName ? ` ${subCommandName}` : ''}`);
		if(userLimited.error) {
			return interaction.reply({
				content: userLimited.error,
				flags: MessageFlags.Ephemeral
			});
		}

		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) return;

		try {
			await command.run(interaction.client, interaction);
		} catch (error) {
			console.error(`[ERROR] An error occurred while executing the command "${interaction.commandName}": `, error);
			await interaction[replied ? 'followUp' : 'reply']({
				content: "❌ There was an error executing this command! Please try again later.",
				flags: MessageFlags.Ephemeral
			});
		}
	}
};