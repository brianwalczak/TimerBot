const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { readdirSync } = require('fs')
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const configPath = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : path.join(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
client.modals = new Collection();
client.buttons = new Collection();
client.menus = new Collection();

const rest = new REST().setToken(config.token);
const commands = [];

// ========== Commands ==========
readdirSync('./src/commands').forEach(file => {
  const commandModule = require(`./src/commands/${file}`);
  const commandList = Array.isArray(commandModule) ? commandModule : [commandModule];

  for (const command of commandList) {
    commands.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
  }
});

// ========== Modals + Buttons + Menus ==========
client.commands.forEach(cmd => {
	if (typeof cmd.register === 'function') {
		cmd.register(client);
	}
});

// ========== Events ==========
readdirSync('./src/events').forEach(file => {
	const event = require(`./src/events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
});

client.once("ready", async () => {
	try {
		const shardId = client.shard?.ids?.[0] ?? 0;
		
		if (!client.shard || shardId === 0) {
			console.log(`${chalk.blue('[REGISTER]')} Registering slash commands w/ Discord API...`);
			await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
			console.log(`${chalk.blue('[REGISTER]')} Slash commands successfully registered.`);
		}
	} catch (error) {
		console.error(`${chalk.red('[ERROR]')} Failed during bot initialization:`, error);
	}
});


function fatalErr(error, type = 'Unknown') {
  return console.error(`${chalk.red('[ERROR]')} ${type}:\n`, error);
}

process.on('uncaughtException', err => fatalErr(err, 'Uncaught Exception'));
process.on('unhandledRejection', err => fatalErr(err, 'Unhandled Rejection'));
process.on('uncaughtExceptionMonitor', err => fatalErr(err, 'Exception Monitor'));

client.login(config.token);