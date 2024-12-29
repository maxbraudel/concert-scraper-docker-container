const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const discord = require('discord.js');

// Initialize stealth plugin
puppeteer.use(StealthPlugin());

// Constants
const CHECK_INTERVAL = 4000;
const TIMEOUT = 20000;
const MAX_RETRIES = 3;
let isShuttingDown = false;

// Create config directory if it doesn't exist
if (!fs.existsSync('./config')) {
    fs.mkdirSync('./config');
    console.log('Created config directory');
}

// Create config.json with empty values if it doesn't exist
if (!fs.existsSync('./config/config.json')) {
    const defaultConfig = {
        "discord-bot-token": "",
        "discord-channel-id": ""
    };
    fs.writeFileSync('./config/config.json', JSON.stringify(defaultConfig, null, 4));
    console.log('Created empty config.json file');
}

const config = require('./config/config.json');

if (!config['discord-bot-token'] || !config['discord-channel-id']) {
    console.error('Error: Please fill in the bot token and channel ID in config/config.json');
    process.exit(1);
}

const botToken = config['discord-bot-token'];
const CHANNEL_ID = config['discord-channel-id'];

const bot = new discord.Client({ intents: 53575421 });

// Create target.txt if it doesn't exist
if (!fs.existsSync('./config/target.txt')) {
    fs.writeFileSync('./config/target.txt', '');
    console.log('Created empty target.txt file');
}

let browser = null;

// Graceful shutdown handling
async function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('Shutting down gracefully...');
    
    if (browser) {
        await browser.close();
    }
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Validate URL format
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

bot.login(botToken).catch(error => {
    console.error('Failed to connect to Discord:', error);
    process.exit(1);
});

bot.on("ready", () => {
    console.log("Bot is ready!");

    const filePath = path.join(__dirname, '/config/target.txt');
    let TARGET_URL = fs.readFileSync(filePath, 'utf8').trim();
    if (!isValidUrl(TARGET_URL)) {
        console.error('Invalid URL in target.txt');
        sendDiscordNotification("⛔ Invalid URL provided in target.txt");
        return;
    }
    
    let TARGET_URL_PREVIOUS = TARGET_URL;
    let ticketAvailableSequenceCounter = 0;
    let pageError = false;

    // Set up file watcher with debounce
    let watchTimeout;
    fs.watch(filePath, (eventType, filename) => {
        if (watchTimeout) clearTimeout(watchTimeout);
        watchTimeout = setTimeout(async () => {
            if (eventType === 'change') {
                try {
                    const newUrl = fs.readFileSync(filePath, 'utf8').trim();
                    if (!isValidUrl(newUrl)) {
                        console.error('Invalid URL provided');
                        sendDiscordNotification("⛔ Invalid URL provided");
                        return;
                    }
                    
                    if (TARGET_URL_PREVIOUS !== newUrl) {
                        TARGET_URL = newUrl;
                        TARGET_URL_PREVIOUS = newUrl;
                        console.log('Target URL updated to:', TARGET_URL);
                        ticketAvailableSequence = false;
                        if (browser) await browser.close();
                        sendDiscordNotification(`🟢 URL updated: ${TARGET_URL}`);
                    }
                } catch (error) {
                    console.error('Error reading updated target URL:', error);
                }
            }
        }, 1000); // Debounce for 1 second
    });

    async function sendDiscordNotification(message) {
        try {
          // Get the channel where you want to send the message
          const channel = bot.channels.cache.get(CHANNEL_ID);
      
          // Send the message to the channel
          await channel.send(message);
      
          console.log('Message sent successfully!');
        } catch (error) {
          console.error('Error sending message:', error);
        }
    }

    async function removeLastMessage() {
        try {
          // Get the channel where the message was sent
          const channel = bot.channels.cache.get(CHANNEL_ID);
      
          // Get the messages in the channel
          const messages = await channel.messages.fetch({ limit: 1 });
      
          // Check if there are any messages
          if (messages.size > 0) {
            // Get the last message and delete it
            const lastMessage = messages.last();
            await lastMessage.delete();
            console.log('Last message deleted successfully!');
          } else {
            console.log('No messages to delete.');
          }
        } catch (error) {
          console.error('Error deleting last message:', error);
        }
    }

    let noTickets = false;
    let scrapingError = false;
    let ticketAvailableSequence = false

    async function checkTicketAvailability(page) {
        try {
            const result = await Promise.race([
                page.waitForSelector('#event-sellables-customCategories', { timeout: TIMEOUT })
                    .then(() => 'available'),
                page.waitForSelector('.text-center.text-xs.font-semibold', { timeout: TIMEOUT })
                    .then(() => 'unavailable'),
                new Promise(resolve => setTimeout(() => resolve('timeout'), TIMEOUT))
            ]);

            switch (result) {
                case 'available':
                    console.log("Tickets available");
                    noTickets = false;
                    pageError = false
                    ticketAvailableSequence = true
                    return true;
                case 'unavailable':
                    console.log("No tickets available");
                    pageError = false
                    ticketAvailableSequenceCounter = 0
                    ticketAvailableSequence = false
                    if (noTickets === false) {
                        noTickets = true;
                        await sendDiscordNotification("⚠️ No tickets available at the moment");
                    }
                    return true;
                default:
                    console.log("Page load timeout");
                    if (pageError === false) {
                        pageError = true
                        // await sendDiscordNotification("⛔ Invalid URL provided");
                    }
                    return false;
            }
        } catch (error) {
            console.error("Error checking availability:", error);
            return false;
        }
    }

    async function startScraping() {
        let retryCount = 0;

        while (!isShuttingDown) {
            try {
                if (!browser) {
                    browser = await puppeteer.launch({
                        headless: true,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-blink-features=AutomationControlled'
                        ]
                    });
                }

                const page = await browser.newPage();
                
                try {
                    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
                    const success = await checkTicketAvailability(page);
                    
                    if (!success) {
                        throw new Error('Check failed');
                    }
                    
                    retryCount = 0; // Reset retry count on success
                    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
                } catch (error) {
                    console.error("Error during scraping:", error);
                    await page.close();
                    
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) {
                        throw new Error('Max retries exceeded');
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
                }
            } catch (error) {
                if (scrapingError === false) {
                    scrapingError = true;
                    await sendDiscordNotification("⚠️ Scraping error");
                }
                console.error("Fatal error:", error);
                
                if (browser) {
                    await browser.close();
                    browser = null;
                }
                
                if (!isShuttingDown) {
                    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 2));
                }
            }
        }
    }

    async function ticketAvailableLoop() {
        if (ticketAvailableSequence === true && ticketAvailableSequenceCounter < 20) {
          ticketAvailableSequenceCounter++;
      
          if (ticketAvailableSequenceCounter > 1) {
            await removeLastMessage();
          }
      
          await sendDiscordNotification(`@everyone 🎫 **Tickets available! Get your credit card ready!** : ${TARGET_URL}`);
        }
      }
      
    setInterval(ticketAvailableLoop, 2000);

    async function removeAllMessages() {
        const channel = await bot.channels.fetch(CHANNEL_ID);
        try {
            let messages;
            do {
                messages = await channel.messages.fetch({ limit: 100 });
                await channel.bulkDelete(messages);
            } while (messages.size >= 2);
        } catch (error) {
            console.error('Error deleting messages:', error);
        }
        console.log('Messages deleted successfully');
    }

    removeAllMessages().then(() => {
        sendDiscordNotification("🟢 Scraper starting");
        startScraping();
    })
});
