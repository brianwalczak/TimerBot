const { SlashCommandBuilder, EmbedBuilder, ApplicationIntegrationType, InteractionContextType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("View the current status and stats of the bot, including server count, memory usage, and uptime.")
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
    const shardId = client.shard?.ids?.[0];
    const uptime = Math.floor(process.uptime());

    await interaction.deferReply();
    const sent = await interaction.fetchReply();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    let totalGuilds = client.guilds.cache.size;
    if (client.shard) {
      const guildCounts = await client.shard.fetchClientValues('guilds.cache.size');
      totalGuilds = guildCounts.reduce((acc, count) => acc + count, 0);
    }

    const embed = new EmbedBuilder()
      .setTitle("Bot Status")
      .setColor(0x5865F2)
      .addFields(
        { name: "🧠 Memory Usage", value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: "📡 WebSocket Ping", value: `${Math.round(shardId ? client.ws.shards.get(shardId).ping : client.ws.ping)}ms`, inline: true },
        { name: "🧩 Shard ID", value: `${shardId ?? 'Standalone'}`, inline: true },
        { name: "🌐 Total Servers", value: `${totalGuilds}`, inline: true },
        { name: "⏱️ Uptime", value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: "📥 Round Trip Latency", value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};