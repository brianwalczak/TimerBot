const { getEvents, isUserPremium } = require('./db.js');
const chalk = require('chalk');
const rateLimits = new Map();

const limits = [ // only these are rate-limited
  { command: 'timer', timeout: 5000 },
  { command: 'alarm', timeout: 5000 },
  { command: 'reminder', timeout: 5000 },
  { command: 'presets run', timeout: 5000 },
  { command: 'presets create', timeout: 15000 }
];

const quotas = {
  "premium": 200,
  "default": 5
};

async function getEventsQuota(userId) {
  const eventsCollection = await getEvents();
  const userEvents = eventsCollection.find({ userId, endTime: { '$gt': Date.now() } });

  return userEvents.length;
}

async function isMaxQuota(userId, commandName, premium) {
  const trackCmds = ['timer', 'alarm', 'reminder', 'presets run'];
  if (!trackCmds.includes(commandName)) return false;

  const quota = premium ? quotas.premium : quotas.default;
  return ((await getEventsQuota(userId)) >= quota) ? quota : false; // check if the user reached the maximum quota
}

function isRateLimited(userId, commandName, premium) {
  if (premium) return false; // premium users are not rate-limited

  const limit = limits.find(l => l.command === commandName);
  if (!limit) return false;

  const key = `${userId}:${commandName}`;
  if (rateLimits.has(key) && rateLimits.get(key) > Date.now()) return (rateLimits.get(key) - Date.now()); // check if the user is rate-limited

  // if not rate-limited then set the rate limit
  rateLimits.set(key, Date.now() + limit.timeout);
  setTimeout(() => rateLimits.delete(key), limit.timeout);
  return false;
}

async function checkUserLimits(userId, commandName) {
  const premium = await isUserPremium(userId);

  const rateLimited = isRateLimited(userId, commandName, premium);
  if (rateLimited) {
    return { error: `⚠️ **Whoops!** You are being rate limited for this command. Please try again in **${Math.round(rateLimited / 1000)} seconds**.` + "\n\nUse `/tip info` to learn how to remove limits and support the development of Timer Bot!" };
  }

  const maxQuota = await isMaxQuota(userId, commandName, premium);
  if (maxQuota != false) {
    return { error: `⚠️ **Whoops!** You've reached your limit of ${maxQuota} active events. Please wait for an event to finish before creating a new one.`  + "\n\nUse `/tip info` to learn how to increase your quota and support the development of Timer Bot!" };
  }

  return { success: true };
}

console.log(`${chalk.blue('[RATE LIMITING]')} Rate limiting and quotas initialized successfully.`);
module.exports = { checkUserLimits };