const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chalk = require('chalk');

async function getUsers() {
    return await prisma.user.findMany();
}

async function getUser(userId) {
    return await prisma.user.findUnique({ where: { id: userId } });
}

async function getEvents(userId = null) {
    let events = [];

    if(!userId) {
      events = await prisma.event.findMany();
    } else {
      events = await prisma.event.findMany({
        where: {
          userId,
          endTime: { gt: BigInt(Date.now()) }
        }
      });
    }

    return events.map(event => ({
      ...event,
      endTime: (event.endTime !== null && event.endTime !== undefined) ? Number(event.endTime) : event.endTime,
    }));
}

async function expiredEvents() {
    let events = await prisma.event.findMany({
      where: {
        endTime: { lte: BigInt(Date.now()) }
      }
    });

    return events.map(event => ({
      ...event,
      endTime: (event.endTime !== null && event.endTime !== undefined) ? Number(event.endTime) : event.endTime,
    }));
}

async function getEvent(eventId) {
    let event = await prisma.event.findUnique({ where: { id: eventId } });

    if(event && event.endTime) {
      event.endTime = Number(event.endTime);
    }

    return event;
}

async function deleteEvent(eventId) {
    await prisma.event.delete({ where: { id: eventId } });
    return true;
}

async function insertEvent(data) {
    if(data.endTime) data.endTime = BigInt(data.endTime);
    await prisma.event.create({ data: data });
    
    return true;
}

async function getPresets(userId) {
    const user = await getUser(userId);
    return user?.presets || [];
}

async function getPreset(userId, tag) {
    const presets = await getPresets(userId);
    return presets.find(p => p.tag === tag);
}

async function deletePreset(userId, tag) {
    const user = await getUser(userId);
    if (!user?.presets || !Array.isArray(user?.presets)) return null;

    const index = user.presets.findIndex(p => p.tag === tag);
    if (index === -1) return false;

    user.presets.splice(index, 1);
    await prisma.user.update({
      where: { id: userId },
      data: { presets: user.presets }
    });

    return true;
}

async function insertPreset(userId, data) {
    const user = await getUser(userId);

    if (!user) {
        await prisma.user.create({ data: { id: userId, presets: [data] } });
    } else {
        const presets = user.presets || [];
        presets.push(data);

        await prisma.user.update({
            where: { id: userId },
            data: { presets }
        });
    }

    return true;
}


async function setUserTimezone(userId, timezone) {
  const user = await getUser(userId);

  if (!user) {
    await prisma.user.create({
      data: { id: userId, presets: [], timezone }
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { timezone }
    });
  }

  return true;
}

async function setPremiumUser(userId, order, preventOverwrite = false) {
  const user = await getUser(userId);

  if (!user) {
    // Only insert the new user if they provided a valid order
    if(order !== null && order !== undefined) {
      await prisma.user.create({
        data: {
          id: userId,
          presets: [],
          premium: order
        }
      });
    }
  } else if(preventOverwrite && (user.premium !== null && user.premium !== undefined)) {
    // If preventOverwrite is true and the user already has a premium status, do not overwrite it
    return false;
  } else {
    if(order === null || order === undefined) {
      // If they didn't specify a valid order, remove the premium status
      await prisma.user.update({
        where: { id: userId },
        data: { premium: null }
      });
    } else {
      // Otherwise set the premium status to the provided order
      await prisma.user.update({
        where: { id: userId },
        data: { premium: order }
      });
    }
  }

  return true;
}

async function isUserPremium(userId) {
  const user = await getUser(userId);
  if(!user || !user.premium) return false;

  return (user.premium && (user.premium !== null && user.premium !== undefined));
}

console.log(`${chalk.blue('[DATABASE]')} Database connections established successfully.`);
process.on('SIGINT', async () => {
  try {
    // quick little fix to make sure it saves before exiting
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error disconnecting Prisma:', err);
    process.exit(1);
  }
});

module.exports = { getUsers, getUser, getEvents, expiredEvents, getEvent, deleteEvent, insertEvent, getPresets, getPreset, deletePreset, insertPreset, setUserTimezone, setPremiumUser, isUserPremium };