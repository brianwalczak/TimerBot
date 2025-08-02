const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getMsDuration, createTimeString } = require('../utils.js');
const { Cache, Database } = require('../ipc.js');
const { Modals, Embeds } = require('../elements.js');
const { ulid } = require("ulid");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("presets")
    .setDescription("View the list of your custom presets.")
        .addSubcommand(subcommand => subcommand
			.setName('create')
			.setDescription('Create a new preset for an event of your choice.')
            .addStringOption(option =>
                option.setName('tag')
                .setDescription('A unique name for your preset that will be used to search for it.')
                .setRequired(true)
            )
            .addStringOption(option =>
			    option.setName('ping')
			    .setDescription("Enter a user or role to ping for the preset. If none is entered, only you will be notified.")
			    .setRequired(false)
            )
		)
        .addSubcommand(subcommand => subcommand
            .setName('run')
            .setDescription('Run a previously saved preset.')
            .addStringOption(option =>
                option.setName('tag')
                .setDescription("The tag of the preset you'd like to run.")
                .setRequired(true)
            )
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('Select a custom channel to send the alert. If none is selected, it will be sent in this channel.')
                .setRequired(false)
            )
        ),
  run: async (client, interaction) => {
    const command = interaction.options.getSubcommand();
    let tag = interaction.options.getString('tag');

    if(tag) {
        tag = tag.trim().toLowerCase();

        if (!/^[a-zA-Z0-9]+$/.test(tag)) {
            return interaction.reply({
                content: "❌ Tags can only contain letters and numbers (no spaces or symbols).",
                flags: MessageFlags.Ephemeral
            });
        } else if(tag.length < 3 || tag.length > 20) {
            return interaction.reply({
                content: "❌ Your tag must be between 3 and 20 characters long.",
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (command === 'create') {
        const flow = interaction.id;
        
        // check if they already have a preset with this tag
        const presets = await Database.getPresets(interaction.user.id);

        if (presets.some(p => p.tag === tag)) {
            return interaction.reply({
                content: `❌ It looks like you already have a preset with the tag \`${tag}\`. Please choose a different tag.`,
                flags: MessageFlags.Ephemeral
            });
        }

        await Cache.setCache(flow, {
            tag: tag,
		    ping: interaction.options.getString("ping") ?? null,
		    userId: interaction.user.id
	    }, (60000 * 5));

        const modal = Modals.timer(flow).setCustomId(`createPreset+${flow}`);
        await interaction.showModal(modal);


    } else if(command === 'run') {
        const channel = interaction.options.getChannel('channel');
        let preset = await Database.getPreset(interaction.user.id, tag);

        if (!preset) {
            return interaction.reply({
                content: `❌ It looks like you don't have a preset with the tag \`${tag}\`.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const endTime = (Date.now() + preset.totalMs);
        const eventId = ulid();

        delete preset.tag;
        delete preset.totalMs;
        await Database.insertEvent({
            channelId: channel?.id ?? interaction?.channel?.id ?? null,
            userId: interaction.user.id,
            id: eventId,
            endTime: endTime,
            ...preset,
            type: 'timer'
        });

        const { embed, components } = Embeds.event({ type: 'timer', user: interaction.user, data: preset, eventId });
        embed.setTitle("✅ Preset Loaded");
        embed.setDescription(`Your preset has started successfully and will end <t:${Math.floor(endTime / 1000)}:R>.`);

		await interaction.reply({
			embeds: [embed],
			components: components
		});
    }
  },
  async register(client) {
    client.modals.set('createPreset', async interaction => {
        const [base, flow] = interaction.customId.split('+');

        const hours = parseInt(interaction.fields.getTextInputValue("hours")) || 0;
		const minutes = parseInt(interaction.fields.getTextInputValue("minutes")) || 0;
		const seconds = parseInt(interaction.fields.getTextInputValue("seconds")) || 0;

        const totalMs = getMsDuration({ hours, minutes, seconds });
		if (totalMs <= 0) {
			return interaction.reply({
				content: "❌ Your preset must be longer than 0 seconds. Please ensure you entered a valid time.",
				flags: MessageFlags.Ephemeral
			});
		} else if(totalMs > 86400000) {
			return interaction.reply({
				content: "❌ Your preset cannot be longer than 24 hours. Please ensure you entered a valid time.",
				flags: MessageFlags.Ephemeral
			});
		}

		if (!(await Cache.isCache(flow))) {
			return interaction.reply({
                content: "⚠️ **Whoops!** Looks like your preset wasn't able to be created. Please try again.",
                flags: MessageFlags.Ephemeral
            });
		}

        const cache = await Cache.getCache(flow);
        const presetData = {
            tag: cache.tag,
            timeString: createTimeString({ hours, minutes, seconds }),
            totalMs,
            ping: cache.ping
        }

        await Cache.clearCache(flow);
        await Database.insertPreset(interaction.user.id, presetData);

        await interaction.reply({
            content: `✅ **Your preset has been created successfully with the tag \`${cache.tag}\`!**`,
            components: [],
            embeds: [],
            flags: MessageFlags.Ephemeral
        });
    });
  }
};