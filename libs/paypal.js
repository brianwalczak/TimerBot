const { Embeds } = require("../src/elements.js");
const { setPremiumUser } = require('./db.js');
const chalk = require('chalk');
const fs = require('fs');
const path = require("path");

const configPath = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : path.join(__dirname, "../config.json");
let manager;
let config;

function readConfig() {
    if (!fs.existsSync(configPath)) {
        console.error("[PAYPAL] An error occurred while trying to read the config file. PayPal integration has been disabled.");
        return null;
    }

    const raw = fs.readFileSync(configPath, "utf8");
    const res = JSON.parse(raw);

    if(!res.paypal) {
        console.error("[PAYPAL] The config file does not contain PayPal configuration. PayPal integration has been disabled.");
        return null;
    }

    config = res;
    return config;
}

function writeConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("[PAYPAL] An error occurred while trying to write the config file.");
        return false;
    }
}

function isEnabled() {
    readConfig();

    if (!config || !config?.paypal || !config?.paypal?.enabled) {
        return false;
    }

    return true;
}

async function updateAccessToken() {
    if(!config) return null;

    const res = await fetch(`${config.paypal.apiUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });

    if (!res.ok) {
        console.error(`[PayPal] The access token request has failed: ${res.status} ${res.statusText}`);
        return null;
    }

    const data = await res.json();

    if (data.access_token) {
        config.paypal.accessToken = {
            access_token: data.access_token,
            expires_on: (data.expires_in * 1000) + Date.now()
        }

        writeConfig(config);
        return data.access_token;
    }

    return null;
}

async function getAccessToken() {
    const ACCESS_TOKEN = config.paypal?.accessToken;

    if (ACCESS_TOKEN && ACCESS_TOKEN.expires_on && Date.now() < ACCESS_TOKEN.expires_on) {
        return ACCESS_TOKEN.access_token;
    }

    return await updateAccessToken();
}

async function deliverOrder(res, sendDM = false) {
    const [tag, userId, timestamp] = res.purchase_units?.[0]?.reference_id?.split('+') || [];
    if(tag !== config.paypal?.reference || !userId || isNaN(userId)) return false;

    const setPremium = await setPremiumUser(userId, res.id, true);
    if(setPremium === false) return false; // user has already claimed their tip

    if(sendDM && manager) {
        const embed = Embeds.tipClaimed({ order: res });
        embed.setTitle("💖 THANK YOU!!");

        const main = manager.shards.get(0);
        if(main) {
            main.send({
                type: 'user',
                method: 'api',
                id: userId,
                content: 'Hey! Just wanted to stop by and leave this letter here. 😃',
                embeds: [embed.toJSON()]
            });
        }
    }

    return true;
}

async function createOrder(amount, reference) {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const req = await fetch(`${config.paypal.apiUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
                reference_id: `${config.paypal?.reference || 'order'}+${reference}+${Date.now()}`,
                description: "Thank you for your support!",
                soft_descriptor: "TIP BRIAN W",
                payment_instruction: {
                    disbursement_mode: "INSTANT"
                },
                amount: {
                    currency_code: "USD",
                    value: amount.toFixed(2)
                },
            }],
            application_context: {
                brand_name: "Timer Bot",
                landing_page: "BILLING",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `https://discord.gg/xKsUXmsb8V`,
                cancel_url: `https://discord.com`
            }
        })
    });

    if (!req.ok) return null;

    const res = await req.json();
    return res;
}

async function captureOrder(order, sendDM = false) {
    if(!order) return null;
    const capture = `${config.paypal.apiUrl}/v2/checkout/orders/${order.id}/capture`;

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return null;

      const req = await fetch(capture, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      const res = await req.json();
      if(!req.ok) return null;

      const payment = res?.purchase_units?.[0]?.payments?.captures?.[0];

      if(res?.status === "COMPLETED" && payment?.status == "COMPLETED") {
        deliverOrder(res, sendDM);
        return res;
      } else {
        return null;
      }
    } catch (err) {}
}

async function validateOrder(orderId, reference = null) {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const req = await fetch(`${config.paypal.apiUrl}/v2/checkout/orders/${orderId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    });

    if (!req.ok) return { error: "It looks like this PayPal order isn't valid or has expired." };

    const res = await req.json();
    const [tag, userId, timestamp] = res.purchase_units?.[0]?.reference_id?.split('+') || [];

    if(tag !== config.paypal?.reference || (reference !== null && userId !== reference)) {
        return { error: "It looks like this PayPal order isn't associated with your account." };
    }

    const captureIntent = res?.intent === "CAPTURE";
    const payment = res?.purchase_units?.[0]?.payments?.captures?.[0];

    if(res?.status === "CREATED" && captureIntent) {
        return { approved: false, captured: false, order: res };
    }

    if(res?.status === "APPROVED" && captureIntent) {
        const newRes = await captureOrder(res);
        const captured = newRes?.status === "COMPLETED" && newRes?.purchase_units?.[0]?.payments?.captures?.[0]?.status == "COMPLETED";

        return { approved: true, captured: captured, order: newRes };
    }
    
    if(res?.status === "COMPLETED" && payment?.status == "COMPLETED") {
        deliverOrder(res, false);
        return { approved: true, captured: true, order: res };
    }

    return null;
}


function spawnWebhook(lManager) {
    if (!isEnabled()) {
        return console.log(`${chalk.red('[PAYPAL]')} PayPal integration is not enabled or the configuration is missing.`);
    };
    manager = lManager; // store manager for future notifications

    const express = require("express");
    const webhook = express();
    webhook.use(express.json());

    webhook.post("/api/paypal", async (req, res) => {
        const event = req.body;

        if(event.event_type === "CHECKOUT.ORDER.APPROVED") {
            captureOrder(event.resource, true);
        }

        return res.sendStatus(200);
    });

    webhook.listen(7000);
    console.log(`${chalk.blue('[PAYPAL]')} Webhook server is running on port 7000.`);
}

module.exports = { isEnabled, createOrder, validateOrder, spawnWebhook };