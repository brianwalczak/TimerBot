const { SlashCommandBuilder, MessageFlags, ApplicationIntegrationType, InteractionContextType } = require("discord.js");
const { Modals, Embeds, Buttons } = require('../elements.js');
const { Database } = require('../ipc.js');

const admins = ['603517534720753686']; // good luck trying to get admin lol, hardcoded 😉

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Owner-only commands for managing Timer Bot.")
    .addSubcommand(sub => 
      sub.setName("stats")
        .setDescription("View recent bot statistics and user counts.")
    )
    .addSubcommand(sub =>
      sub.setName("premium")
        .setDescription("View or toggle premium status for a user.")
        .addUserOption(option =>
          option.setName("user")
            .setDescription("The user to view or modify.")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("eval")
        .setDescription("Execute a JavaScript expression within Discord.")
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
    if (!admins.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral
      });
    }

    const subcommand = interaction.options.getSubcommand();
    if(subcommand === 'stats') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let totalGuilds = client.guilds.cache.size;
      let totalUsers = 0;
      let largestCount = 0;
      let largestName = '';
      if (client.shard) {
        const guildCounts = await client.shard.fetchClientValues('guilds.cache.size');
        totalGuilds = guildCounts.reduce((acc, count) => acc + count, 0);

        const shardResults = await client.shard.broadcastEval(c => {
          let users = 0;
          let largest = { count: 0, name: '' };
          for (const guild of c.guilds.cache.values()) {
            const memberCount = guild.memberCount || 0;
            users += memberCount;

            if (memberCount > largest.count) {
              largest.count = memberCount;
              largest.name = guild.name;
            }
          }

          return { users, largest };
        });

        for (const result of shardResults) {
          totalUsers += result.users;

          if (result.largest.count > largestCount) {
            largestCount = result.largest.count;
            largestName = result.largest.name;
          }
        }
      } else {
        for (const guild of client.guilds.cache.values()) {
          const memberCount = guild.memberCount || 0;
          totalUsers += memberCount;

          if (memberCount > largestCount) {
            largestCount = memberCount;
            largestName = guild.name;
          }
        }
      }

      const users = await Database.getUsers();
      const events = await Database.getEvents();

      let premiumUsers = 0;
      let overrideUsers = 0;
      
      for (const user of users) {
        if (!user.premium) continue;

        if(user.premium === 'ADMIN_OVERRIDE') {
          overrideUsers++;
        } else {
          premiumUsers++;
        }
      }
      
      const embed = Embeds.admin.stats({
        totalGuilds,
        totalUsers,
        premiumUsers,
        overrideUsers,
        events,
        largestCount,
        largestName
      });

      interaction.editReply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    } else if(subcommand === 'premium') {
      const target = interaction.options.getUser("user");
      const user = await Database.getUser(target.id);
      
      const embed = Embeds.admin.premium({ userId: target.id, isEnabled: user?.premium, admin: interaction.user });
      const buttons = Buttons.admin.premium({ userId: target.id, isEnabled: user?.premium });
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
        components: [buttons]
      });
    } else if(subcommand === 'eval') {
      await interaction.showModal(Modals.admin.eval());
    }
  },
  async register(client) {
    client.modals.set('admin_eval', async interaction => {
      if (!admins.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          flags: MessageFlags.Ephemeral
        });
      }

      const code = interaction.fields.getTextInputValue("code");
      const startTime = Date.now();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      try {
        const result = eval(code);

        if (typeof result === 'object') {
          result = JSON.stringify(result, null, 2);
        }

        const embed = Embeds.admin.eval({
          input: code ?? 'No Input',
          output: result ?? 'No Output',
          ping: (Date.now() - startTime),
          type: result ? typeof result : 'Unidentified'
        });

        await interaction.editReply({
          embeds: [embed]
        });
      } catch (error) {
        const embed = Embeds.admin.eval({
          input: code ?? 'No Input',
          output: error.toString() ?? 'No Output',
          ping: (Date.now() - startTime),
          type: error?.constructor?.name ?? '⚠️ ERROR'
        });

        await interaction.editReply({
          embeds: [embed]
        });
      }
    });

    client.buttons.set('admin_premium', async interaction => {
      if (!admins.includes(interaction.user.id)) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          flags: MessageFlags.Ephemeral
        });
      }

      let [base, userId] = interaction.customId.split('+');
      userId = userId.replace('u_', ''); // prevent checking cache

      const user = await Database.getUser(userId);
      let isEnabled = null;

      if(user?.premium) {
        await Database.setPremiumUser(userId, null); // turn off premium (delete key)
      } else {
        await Database.setPremiumUser(userId, 'ADMIN_OVERRIDE'); // turn on premium
        isEnabled = 'ADMIN_OVERRIDE';
      }

      const embed = Embeds.admin.premium({ userId, isEnabled, admin: interaction.user });
      const buttons = Buttons.admin.premium({ userId, isEnabled });

      await interaction.update({
        embeds: [embed],
        components: [buttons]
      });
    });
  }
};