const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    process.on('message', async (msg) => {
        try {
            const type = msg.type;
            const method = msg.method;
            let messenger;

            if(type === 'channel') {
                messenger = method === 'cache' ? client.channels.cache.get(msg.id) : await client.channels.fetch(msg.id).catch(() => null);
            } else if(type === 'user') {
                messenger = method === 'cache' ? client.users.cache.get(msg.id) : await client.users.fetch(msg.id).catch(() => null);
            } else {
                return;
            }

            if(messenger) {
                try {
                    await messenger.send({
                        content: msg.content || '',
                        embeds: msg.embeds ? msg.embeds.map(data => EmbedBuilder.from(data)) : [],
                        components: msg.components || []
                    });
                } catch (error) {};
            }
        } catch (error) {};
    });
  }
};