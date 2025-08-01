<h1 align="center">Timer Bot (v3) - Discord events made simple</h1>
<p align="center">A powerful time-based bot allowing you to create detailed timers, alarms, and reminders in your Discord server effortlessly.</p>

> [!WARNING]
> **This project is currently in its beta state as I monitor for bugs and gather user feedback. If you encounter any issues, please report them <a href='https://github.com/BrianWalczak/TimerBot/issues'>here</a> :)**

## Features
- (⏱️) Create precise timer countdowns with hours, minutes, and seconds.
- (⏰) Schedule alerts for specific dates and times in your local time zone.
- (📝) Add titles and descriptions to your alarms to be notified of your upcoming events, goals, and more!
- (💾) Save timer configurations with custom names for quick access anytime.
- (📋) Manage all your running timers, alarms, and reminders in one place.
- (🌐) Set your local time zone for accurate alarm scheduling.
- (🔔) Choose users or roles to notify when an event ends.

## Getting Started
To start using Timer Bot in your Discord community, you can invite the bot to your server [here](https://top.gg/bot/759432068651548705).

Once added, you can type `/` followed by one of the commands below:
- `/timer`: Set a custom timer with hours, minutes, and seconds.
- `/alarm`: Set an alarm that goes off at a specific date and time.
- `/reminder`: Set a detailed reminder with a title and description.
- `/presets create`: Create a reusable timer preset for future use.
- `/presets run`: Run a previously saved preset by its custom tag.
- `/list events`: View all active timers, alarms, and reminders.
- `/list presets`: View all saved timer presets.
- `/timezone`: Set your time zone for accurate reminders and alarms.
- `/status`: Check the bot’s uptime, memory usage, and server count.
- `/vote`: Support Timer Bot by voting on Top.gg and others!
- `/support`: Join the Timer Bot support server for help.

**Tip:** you can use the `/help` command to view this list at any time!

## Self-Hosting
> [!NOTE]
> **Self-hosting is optional and intended for developers or advanced users who want more control. Most users won't need to self-host.**

> [!WARNING]
> **Before starting the bot, make sure you have a valid `config.json` file containing your configuration (such as your Discord bot token, or PayPal API credentials). For Docker, this file should be placed in the folder you're mounting (e.g., `./data`).**

Prefer to host the bot yourself? Timer Bot is open-source under the Apache 2.0 license, and is easy to set up on your own server.

To start, you can download this repository by using the following:
```bash
git clone https://github.com/BrianWalczak/TimerBot.git
cd TimerBot
```

### Docker
When hosting Timer Bot, it's highly recommended to run it inside a Docker container to keep it isolated from your main machine.

To do this, start by building the image using the provided `Dockerfile`:
```bash
docker build -t timerbot .
```

Once the image is built, you can run the bot with `docker run` or edit the `docker-compose.yml` template included.

```yml
services:
  app:
    image: timerbot
    container_name: timerbot
    ports:
      - "3000:7000" # Exposes port 7000 from the container to port 3000 on your host (change 3000 if needed)
    volumes:
      - ./data:/usr/src/app/data # Replace './data' with the path to your local config.json and database files
    environment:
      FILES_LOCATION: /usr/src/app/data
    restart: unless-stopped
```

### Local Installation
If you prefer to run Timer Bot on your local system, that's fine too! Just make sure that Node.js is properly installed (run `node --version` to check if it exists). If you don't have it installed yet, you can download it [here](https://nodejs.org/en/download).

Next, install the required dependencies and start the bot:
```bash
npm install
node .
```

### Notes
Timer Bot uses both the built-in `Date` object in Node.js and the `luxon` library for handling time calculation. To maintain consistency and avoid issues with timezone (such as conversion to the local server time), it relies on Unix epoch timestamps, which represent time in UTC. This ensures all times are standardized to UTC regardless of the server's local timezone. For alarms and reminders, which require a date and time input, Timer Bot uses `luxon` to correctly handle the event data with the user's local timezone.

Before any event is stored in the database, **all** event types are converted to milliseconds (Unix epoch timestamps), ensuring every stored time is in UTC.

## Contributions
If you'd like to contribute to this project, please create a pull request [here](https://github.com/BrianWalczak/TimerBot/pulls). You can submit your feedback or any bugs that you find on the <a href='https://github.com/BrianWalczak/TimerBot/issues'>issues page</a>. Contributions are highly appreciated and will help us keep this project up-to-date!