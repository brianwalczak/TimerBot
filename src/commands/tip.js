const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ApplicationIntegrationType, InteractionContextType } = require("discord.js");
const { Modals, Buttons, Embeds } = require("../elements.js");
const { PayPal, Database } = require("../ipc.js");
let isEnabled = null;

async function completeTip(interaction, amount) {
  await interaction.deferUpdate({ flags: MessageFlags.Ephemeral });

  const order = await PayPal.createOrder(Number(amount), interaction.user.id);

  if (!order) {
    return interaction.followUp({
      content: "❌ An error occurred while creating your PayPal order. Please try again shortly.",
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("✅ Tip Created")
    .setColor(0x5865F2)
    .setDescription([
      `You can complete your $${amount} tip by using the payment button attached.`,
      `**Order ID:** \`${order.id}\`\n`,
      "__**Note:**__ Once your tip has been submitted, your perks should automatically be processed within 5-10 minutes. If you're experiencing issues, you can use the `/tip claim` command to lookup your payment manually. Thank you for your support!"
    ].join("\n"))
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  const main = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
    .setLabel("Pay with PayPal")
    .setStyle(ButtonStyle.Link)
    .setURL(order.links.find(link => link.rel === "approve").href)
  );

  return interaction.editReply({ embeds: [embed], components: [main], flags: MessageFlags.Ephemeral });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tip")
    .setDescription("Support the project with a small donation and unlock premium perks!")
    .addSubcommand(sub => 
      sub.setName("info")
        .setDescription("Learn how to support the project and unlock premium perks as a thank you!")
    )
    .addSubcommand(sub =>
      sub.setName("claim")
        .setDescription("Claim your premium perks after submitting your tip!")
        .addStringOption(option =>
          option.setName("order_id")
            .setDescription("Enter the PayPal order ID for your tip (found in the confirmation message).")
            .setRequired(true)
        )
    )
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
    if(isEnabled === null) isEnabled = await PayPal.isEnabled(); // initial run
    const subcommand = interaction.options.getSubcommand();

    if(!isEnabled) {
      return interaction.reply({
        content: "❌ Sorry! It looks like tips are currently disabled. Please try again later.",
        flags: MessageFlags.Ephemeral
      });
    }
    
    if(subcommand === "info") {
        const embed = new EmbedBuilder()
            .setTitle("💖 Tip & Support")
            .setColor(0xFFD700)
            .setDescription([
                "Hey there, I'm **Brian**.",
                "I'm a student and full-stack developer with 5+ years of experience, specializing in back-end work using Node.js. I love building useful things for people and tinkering with electronics.\n",
                "If you've found Timer Bot helpful or just want to support a solo developer, I'd appreciate if you could leave a tip! As a thank you, you'll unlock some premium perks like:",
                "- **No Cooldown**: Use all commands without waiting for cooldowns.",
                "- **Upgraded Limits**: Enjoy higher usage limits for commands, with up to 200 active events at any time.",
                "- **Priority Support**: Get faster help in the support server."
            ].join("\n"))
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const buttons = Buttons.tip();
        const userPremium = await Database.isUserPremium(interaction.user.id);
        await interaction.reply({ content: userPremium ? "Heads up! You already have access to premium perks." : '', embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral });


    } else if(subcommand === "claim") {
       const orderId = interaction.options.getString("order_id");

       if (!orderId || orderId.length > 32 || !/^[A-Z0-9]+$/.test(orderId)) {
        return interaction.reply({
            content: "❌ That doesn't look like a valid PayPal order ID. Please double-check and try again.",
            flags: MessageFlags.Ephemeral
        });
       }
       
       await interaction.deferReply({ flags: MessageFlags.Ephemeral });
       const orderDetails = await PayPal.validateOrder(orderId, interaction.user.id);

       if(!orderDetails) {
        return interaction.editReply({
            content: "⚠️ **Whoops!** It looks like an unknown error occurred while processing your tip. Please try again later.",
            flags: MessageFlags.Ephemeral
        });
       } else if(orderDetails.error) {
        return interaction.editReply({
            content: "❌ " + orderDetails.error,
            flags: MessageFlags.Ephemeral
        });
       }

       if(orderDetails.approved === false) {
        return interaction.editReply({
            content: "❌ This PayPal order hasn't been completed yet. Please ensure you completed the payment.",
            flags: MessageFlags.Ephemeral
        });
       } else if(orderDetails.approved === true && orderDetails.captured === false) {
        return interaction.editReply({
          content: "⚠️ Your tip is currently being processed but hasn't yet been approved by your card issuer. Please wait a few minutes and try again.",
          flags: MessageFlags.Ephemeral
        });
       } else if(orderDetails.approved === true && orderDetails.captured === true) {
        const embed = Embeds.tipClaimed({ order: orderDetails.order});

        await interaction.editReply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral
        });
       }
    }
  },
  async register(client) {
    client.buttons.set('tip5', i => completeTip(i, 5));
    client.buttons.set('tip10', i => completeTip(i, 10));
    client.buttons.set('tip15', i => completeTip(i, 15));
    client.buttons.set('tipCustom', async interaction => {
      await interaction.showModal(Modals.tip());
    });

    client.modals.set('tipCustom', async interaction => {
      const amount = parseFloat(interaction.fields.getTextInputValue("amount").replaceAll('$', ''));

      if(isNaN(amount) || amount <= 5) {
        return interaction.reply({
          content: "❌ Please enter a valid amount greater than $5 (PayPal fees, sorry!).",
          flags: MessageFlags.Ephemeral
        });
      }

      return completeTip(interaction, amount);
    });
  }
};