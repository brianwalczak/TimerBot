const { ShardingManager } = require('discord.js');
const { IPCListener } = require('./ipc.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const configPath = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : path.join(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const manager = new ShardingManager('./main.js', {
  token: config.token,
  totalShards: 'auto'
});

manager.on('shardCreate', shard => {
  console.log(`${chalk.yellow('[SHARD]')} Successfully launched shard ${shard.id}...`);

  shard.on('spawn', () => console.log(`${chalk.yellow('[SHARD]')} Shard ${shard.id} has been spawned.`));
  shard.on('ready', () => console.log(`${chalk.yellow('[SHARD]')} Shard ${shard.id} is ready!`));
  shard.on('disconnect', () => console.warn(`${chalk.yellow('[SHARD]')} Shard ${shard.id} has disconnected.`));
  shard.on('reconnecting', () => console.log(`${chalk.yellow('[SHARD]')} Shard ${shard.id} is reconnecting...`));
  shard.on('death', proc => console.error(`${chalk.yellow('[SHARD]')} Shard ${shard.id} died with code ${proc.exitCode}.`));
  shard.on('error', err => console.error(`${chalk.yellow('[SHARD]')} Shard ${shard.id} encountered an error:\n`, err));
});

function fatalErr(error, type = 'Unknown') {
  console.error(`${chalk.red('[ERROR]')} ${type}:\n`, error);
  
  return process.exit(1);
}

process.on('uncaughtException', err => fatalErr(err, 'Uncaught Exception'));
process.on('unhandledRejection', err => fatalErr(err, 'Unhandled Rejection'));
process.on('uncaughtExceptionMonitor', err => fatalErr(err, 'Exception Monitor'));

manager.spawn({ timeout: 300_000 }).then(shards => {
  shards.forEach(shard => {
    shard.on('message', message => {
      return IPCListener.getMessage(shard, message);
    });
  });

  require('./libs/rateLimiter.js');
  require('./libs/cache.js');
  require('./libs/db.js');
  require('./libs/databaseUpdate.js')(manager);
  require('./libs/paypal.js').spawnWebhook(manager);
}).catch(err => {
  console.error(`${chalk.red('[SHARD]')} A critical error prevented spawning shards:\n`, err);

  return process.exit(1);
});