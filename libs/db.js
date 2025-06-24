const loki = require('lokijs');
const chalk = require('chalk');
let resolveEvents;
let resolveConfig;

const path = require('path');
const eventsPath = process.env.FILES_LOCATION ? path.join(process.env.FILES_LOCATION, 'events.db') : path.join(__dirname, "../events.db");
const configPath = process.env.FILES_LOCATION ? path.join(process.env.FILES_LOCATION, 'config.db') : path.join(__dirname, "../config.db");

const eventsReady = new Promise(resolve => (resolveEvents = resolve));
const events = new loki(eventsPath, {
    autoload: true,
    autoloadCallback: () => {
        if (!events.getCollection('events')) {
            events.addCollection('events', { indices: ['userId', 'channelId'] });
        }

        resolveEvents();
    },
    autosave: true,
    autosaveInterval: 5000
});

const configReady = new Promise(resolve => (resolveConfig = resolve));
const config = new loki(configPath, {
    autoload: true,
    autoloadCallback: () => {
        if(!config.getCollection('users')) {
            config.addCollection('users', { indices: ['id'], unique: ['id'] });
        }

        resolveConfig();
    },
    autosave: true,
    autosaveInterval: 5000
});

async function getUser(userId) {
    await configReady;

    const users = config.getCollection('users');
    return users.by('id', userId);
}

async function getEvents(userId = null) {
    await eventsReady;

    const collection = events.getCollection('events');
    if(!userId) return collection;

    return collection.find({ userId, endTime: { '$gt': Date.now() } }) || [];
}

async function getEvent(userId, eventId) {
    await eventsReady;

    const collection = events.getCollection('events');
    return collection.findOne({ userId: userId, id: eventId });
}

async function deleteEvent(event) {
    await eventsReady;

    const collection = events.getCollection('events');
    collection.remove(event);
    return true;
}

async function insertEvent(data) {
    await eventsReady;

    const collection = events.getCollection('events');
    collection.insert(data);
    return true;
}

async function getPresets(userId) {
    await configReady;
    const user = await getUser(userId);

    return user?.presets || [];
}

async function getPreset(userId, tag) {
    await configReady;
    const presets = await getPresets(userId);

    return presets.find(p => p.tag === tag);
}

async function deletePreset(userId, tag) {
    await configReady;

    const user = await getUser(userId);
    if (!user?.presets || !Array.isArray(user?.presets)) return null;

    const index = user.presets.findIndex(p => p.tag === tag);
    if (index !== -1) {
        user.presets.splice(index, 1);

        return true;
    }

    return false;
}

async function insertPreset(userId, data) {
    await configReady;

    const users = config.getCollection('users');
    let user = users.by('id', userId);

    if (!user) {
        users.insert({ id: userId, presets: [data] });
    } else {
        const presets = user.presets || [];
        users.update({ ...user, presets: [...presets, data] });
    }

    return true;
}


async function setUserTimezone(userId, timezone) {
  await configReady;

  const users = config.getCollection('users');
  const user = users.by('id', userId);

  if (!user) {
    users.insert({ id: userId, presets: [], timezone });
  } else {
    users.update({ ...user, timezone });
  }

  return true;
}

async function setPremiumUser(userId, order) {
  await configReady;

  const users = config.getCollection('users');
  const user = users.by('id', userId);

  if (!user) {
    users.insert({ id: userId, presets: [], premium: order });
  } else if (user.premium === null || user.premium === undefined) {
    users.update({ ...user, premium: order });
  } else {
    return false;
  }

  return true;
}

async function isUserPremium(userId) {
  await configReady;
  const user = await getUser(userId);
  if(!user || !user.premium) return false;

  return (user.premium && (user.premium !== null && user.premium !== undefined));
}

console.log(`${chalk.blue('[DATABASE]')} Database connections established successfully.`);
process.on('SIGINT', async () => {
  try {
    // quick little fix to make sure it saves before exiting
    await Promise.all([
      new Promise(resolve => events.saveDatabase(resolve)),
      new Promise(resolve => config.saveDatabase(resolve))
    ]);

    process.exit(0);
  } catch (err) {
    console.error('Error saving databases:', err);
    process.exit(1);
  }
});

module.exports = { getUser, getEvents, getEvent, deleteEvent, insertEvent, getPresets, getPreset, deletePreset, insertPreset, setUserTimezone, setPremiumUser, isUserPremium };