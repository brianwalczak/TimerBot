const { prompt } = require('enquirer');
const loki = require('lokijs');
const { spawn } = require('child_process');
let PrismaClient;
let prisma;

async function loadDatabase(path) {
    return new Promise((resolve, reject) => {
        const db = new loki(path, {
            autoload: true,
            autoloadCallback: () => {
                resolve(db);
            },
            autosave: false,
            autoloadErrorCallback: (err) => {
                reject(err);
            }
        });
    });
}

async function migrateUsers(path) {
    const db = await loadDatabase(path);
    const users = db.getCollection('users');
    if(!users) return console.log('Your users collection is empty.');

    if (users && users.data.length) {
        try {
            const formattedUsers = users.data.map(({ $loki, meta, ...data }) => data);

            await prisma.user.createMany({
                data: formattedUsers,
                skipDuplicates: true
            });
        } catch(error) {
            console.error('Error migrating users:', error);
        }
    }

    return true;
}

async function migrateEvents(path) {
    const db = await loadDatabase(path);
    const events = db.getCollection('events');
    if(!events) return console.log('Your events collection is empty.');

    if (events && events.data.length) {
        try {
            const formattedEvents = events.data.map(({ $loki, meta, ...data }) => {
                if (data.endTime && typeof data.endTime !== 'bigint') {
                    data.endTime = BigInt(data.endTime);
                }

                return data;
            });

            await prisma.event.createMany({
                data: formattedEvents,
                skipDuplicates: true
            });
        } catch (error) {
            console.error('Error migrating event:', error);
        }
    }

    return true;
}

async function main() {
  const response = await prompt([
    {
      type: 'input',
      name: 'config',
      message: 'Enter the path to your LokiJS user configuration database (config.db):',
      initial: './config.db'
    },
    {
      type: 'input',
      name: 'events',
      message: 'Enter the path to your LokiJS events database (events.db):',
      initial: './events.db'
    }
  ]);

  try {
    ({ PrismaClient } = require('@prisma/client'));
    prisma = new PrismaClient();
  } catch(error) {
    const response = await prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'It looks like your Prisma database is not set up yet. Would you like to set it up now?',
            initial: true
        }
    ]);

    if(response.confirm) {
      console.log('Running Prisma migration, this may take a while...');

      await new Promise((resolve, reject) => {
        spawn('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: true }).on('close', (code) => {
          if (code === 0) {
            console.log('Prisma migration completed successfully! Generating Prisma client...');
            resolve();
          }
        });
      });

      await new Promise((resolve, reject) => {
        spawn('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true }).on('close', (code) => {
          if (code === 0) {
            console.log('Prisma client generated successfully! Starting Loki migration...');
            resolve();
          }
        });
      });
      
      ({ PrismaClient } = require('@prisma/client'));
      prisma = new PrismaClient();
    } else {
        throw new Error(error);
    }
  }

  console.log('Please wait, your users database is now being migrated...');

  await migrateUsers(response.config);

  console.log('Success! Please wait, your events database is now being migrated...');

  await migrateEvents(response.events);

  console.log('Success! Your LokiJS migration has been completed.');

  await prisma.$disconnect();
}

main();
process.on('exit', async () => await prisma?.$disconnect());