require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { Agent } = require('undici');
const dns = require('dns');

// Force IPv4 for Discord API to prevent Connect Timeout Error with Undici
const ipv4Agent = new Agent({ 
    connect: { 
        timeout: 60000, 
        lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback)
    },
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 600000
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});
client.rest.setAgent(ipv4Agent);
client.commands = new Collection();

// Global Error Handlers
process.on('unhandledRejection', error => console.error('[ATLAS] Unhandled Promise Rejection:', error));
process.on('uncaughtException', error => console.error('[ATLAS] Uncaught Exception:', error));

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

async function startBot() { 
    try { 
        console.log('[ATLAS] Attempting login...');
        await client.login(process.env.DISCORD_TOKEN); 
    } catch (e) { 
        console.error('[ATLAS] Login failed:', e.message);
        setTimeout(startBot, 10000); 
    } 
}
startBot();
