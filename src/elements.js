const { EmbedBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const Modals = {
  timer(flow) {
    const modal = new ModalBuilder()
      .setCustomId(`timerModal+${flow}`)
      .setTitle('Timer Details');

	  const hours = new TextInputBuilder()
      .setCustomId('hours')
      .setLabel('Hours')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter number of hours')
      .setRequired(true);

    const minutes = new TextInputBuilder()
      .setCustomId('minutes')
      .setLabel('Minutes')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter number of minutes')
      .setRequired(true);

    const seconds = new TextInputBuilder()
      .setCustomId('seconds')
      .setLabel('Seconds')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter number of seconds')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(hours), new ActionRowBuilder().addComponents(minutes), new ActionRowBuilder().addComponents(seconds));
	  return modal;
  },
  alarm(flow) {
    const modal = new ModalBuilder()
      .setCustomId(`alarmModal+${flow}`)
      .setTitle('Alarm Details');

	  const dateInput = new TextInputBuilder()
      .setCustomId('date')
      .setLabel('Date (MM-DD-YYYY)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 07-04-2025')
      .setRequired(true);

	  const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Time (HH:MM, 24hr format)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 16:30')
      .setRequired(true);

	  modal.addComponents(new ActionRowBuilder().addComponents(dateInput), new ActionRowBuilder().addComponents(timeInput));
	  return modal;
  },
  reminder(flow) {
    const modal = this.alarm(flow);
    modal.setCustomId(`reminderModal+${flow}`)
      .setTitle('Reminder Details');

    const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Reminder Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Homework, Meeting, Library')
    .setRequired(true)
    .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Reminder Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Optional details...')
      .setRequired(false)
      .setMaxLength(750);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descriptionInput));
    return modal;
  },
  viewEvent() {
    const modal = new ModalBuilder()
      .setCustomId('viewItem+events')
      .setTitle('View Event');

    const eventInput = new TextInputBuilder()
      .setCustomId('eventId')
      .setLabel('Enter the Event ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 01JXPC1D33502Q9QCFA525ZVW1')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(eventInput));
    return modal;
  },
  viewPreset() {
    const modal = new ModalBuilder()
      .setCustomId('viewItem+presets')
      .setTitle('View Preset');

    const tagInput = new TextInputBuilder()
      .setCustomId('tag')
      .setLabel('Enter the preset tag')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. mypreset')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(tagInput));
    return modal;
  },
  tip() {
    const modal = new ModalBuilder()
      .setCustomId('tipCustom')
      .setTitle('Leave a Tip');

    const amountInput = new TextInputBuilder()
      .setCustomId('amount')
      .setLabel('Enter the tip amount')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 5, or a custom amount')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    return modal;
  },
  convert(flow) {
    const modal = new ModalBuilder()
      .setCustomId(`convert+${flow}`)
      .setTitle('Convert Time Zone');

    const dateInput = new TextInputBuilder()
      .setCustomId('date')
      .setLabel('Date (MM-DD-YYYY)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 07-04-2025')
      .setRequired(true);

	  const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Time (HH:MM, 24hr format)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 16:30')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(dateInput), new ActionRowBuilder().addComponents(timeInput));
    return modal;
  },
  admin: {
    eval() {
      const modal = new ModalBuilder()
        .setCustomId('admin_eval')
        .setTitle('🧪 Run Test');

      const codeInput = new TextInputBuilder()
        .setCustomId('code')
        .setLabel('JS Code')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
      return modal;
    }
  }
};

const Embeds = {
  event({ type, flow = null, user, data, eventId = null }) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() })
      .setTimestamp();

    if (type === 'timer') {
      const { timeString, ping } = data;

      embed.addFields(
        { name: "⏲ Duration", value: `\`${timeString}\``, inline: true },
        { name: "📣 Ping", value: ping ?? `<@${user.id}>`, inline: true }
      );
    }

    if (type === 'alarm' || type === 'reminder') {
      const { endTime, ping, tz } = data;
      const fields = [
        { name: "⏲ Duration", value: `<t:${Math.floor(endTime / 1000)}:f>`, inline: true },
        { name: "🌐 Timezone", value: tz, inline: true },
        { name: "📣 Ping", value: ping ?? `<@${user.id}>`, inline: true }
      ];

      if(type === 'reminder') {
        const { title, desc } = data;

        fields.push(
          { name: "📝 Title", value: title, inline: false },
          { name: "📜 Description", value: desc || "No description provided.", inline: false }
        );
      }

      embed.addFields(fields);
    }

    let buttons;
    if(flow) {
      buttons = Buttons.confirm(flow, type);
    } else {
      buttons = Buttons.ics(eventId);
    }

    return { embed, components: (buttons ? [buttons] : []) };
  },
  tipClaimed({ order }) {
    const price = order?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const embed = new EmbedBuilder()
      .setTitle("💖 Tip Claimed")
      .setColor(0xFFD700)
      .setDescription([
        `Thank you so much for your generous${price ? ` **$${price}**` : ''} tip! As a solo developer, tips like these help me keep building and pursuing my passion for coding.\n`,
        "Your support allows me to continue maintaining the server costs for this bot and adding new features. Timer Bot wouldn't be possible without awesome people like you! ✌️\n",
        `If you have any issues or questions, feel free to reach out in the support server.`,
        `Enjoy the extra features and thank you again! Your support means a lot (seriously).`
      ].join("\n"));

    return embed;
  },
  admin: {
    stats({ totalGuilds, totalUsers, premiumUsers, overrideUsers, events, largestCount, largestName }) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Bot Statistics")
        .setColor(0xff0000)
        .setTimestamp()
        .addFields(
          { name: "🌐 Total Servers", value: `${totalGuilds}`, inline: true },
          { name: "👥 Total Users", value: `${totalUsers}`, inline: true },
          { name: "⭐ Premium Users", value: `${premiumUsers}${overrideUsers > 0 ? ` **(+${overrideUsers} overrides)**` : ''}`, inline: true },
          { name: "⏲️ Total Timers", value: `${events.filter(e => e.type === 'timer').length}`, inline: true },
          { name: "⏰ Total Alarms", value: `${events.filter(e => e.type === 'alarm').length}`, inline: true },
          { name: "📝 Total Reminders", value: `${events.filter(e => e.type === 'reminder').length}`, inline: true },
          { name: "👑 Largest Server", value: `${largestName}`, inline: true },
          { name: "👥 Members", value: `${largestCount}`, inline: true }
        )
        .setFooter({ text: "Admin Panel" });

      return embed;
    },
    eval({ input, output, ping, type }) {
      const embed = new EmbedBuilder()
        .setTitle("🧪 Test Results")
        .setColor(0x00ff00)
        .setTimestamp()
        .setDescription(`Evaluated in: *${ping.toFixed(1)}ms*`)
        .addFields(
          { name: ":inbox_tray: Input", value: `\`\`\`${input}\`\`\`` },
          { name: ":outbox_tray: Output", value: `\`\`\`${output}\`\`\`` },
          { name: "Type", value: `\`\`\`${type}\`\`\`` }
        );

      return embed;
    },
    premium({ userId, isEnabled, admin }) {
      const embed = new EmbedBuilder()
        .setTitle(`⭐ Premium Details`)
        .setColor(0xFFD700)
        .addFields(
          { name: "Target", value: `<@${userId}>`, inline: true },
          { name: "Premium", value: `${isEnabled ? "✅ Active" : "❌ Inactive"}`, inline: true }
        )
        .setFooter({ text: `Requested by ${admin.tag}`, iconURL: admin.displayAvatarURL() })
        .setTimestamp();

      if(isEnabled) {
        embed.addFields(
          { name: "Method", value: `${isEnabled === 'ADMIN_OVERRIDE' ? "👑 Admin Override" : "⭐ Regular"}`, inline: false }
        );
      }

      return embed;
    }
  }
};

const Buttons = {
  confirm(flow, type) {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
      .setCustomId(`${type}Confirm+${flow}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
      
      new ButtonBuilder()
      .setCustomId(`${type}Cancel+${flow}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
    );

    return buttons;
  },
  tip() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tip5')
        .setLabel('$5')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('tip10')
        .setLabel('$10')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('tip15')
        .setLabel('$15')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('tipCustom')
        .setLabel('Custom')
        .setStyle(ButtonStyle.Secondary)
    );
  },
  ics(eventId) {
    if(!eventId) return null;

    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ics+e_${eventId}`)
        .setLabel('📅 Add to Calendar')
        .setStyle(ButtonStyle.Primary)
    );
  },
  admin: {
    premium({ userId, isEnabled }) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`admin_premium+u_${userId}`)
          .setLabel(isEnabled ? 'Disable Premium' : 'Enable Premium')
          .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
      );
    }
  }
};

module.exports = { Modals, Embeds, Buttons };