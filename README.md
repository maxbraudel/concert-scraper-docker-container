# Concert Ticket Scraper

A Node.js application that monitors concert ticket availability and sends notifications through Discord when tickets become available. Built with Puppeteer for web scraping and Discord.js for notifications.

## Features

- Monitors ticket availability on specified concert websites
- Sends real-time notifications through Discord
- Uses stealth mode to avoid detection
- Configurable through simple JSON configuration
- Runs in a Docker container for easy deployment

## Technologies Used

- Node.js
- Puppeteer (with Stealth Plugin) for web scraping
- Discord.js for notifications
- Docker for containerization
- Axios for HTTP requests

## Prerequisites

- Docker installed on your system
- A Discord bot token
- A Discord channel ID

## Discord Setup

1. Create a Discord Bot:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Go to the "Bot" section and click "Add Bot"
   - Copy the bot token (you'll need this for configuration)

2. Add Bot to Your Server:
   - In the Developer Portal, go to "OAuth2" → "URL Generator"
   - Select "bot" under scopes
   - Select required permissions (at minimum: "Send Messages", "Read Message History")
   - Copy the generated URL and open it in a browser to add the bot to your server

3. Get Channel ID:
   - In Discord, enable Developer Mode (Settings → App Settings → Advanced → Developer Mode)
   - Right-click the channel you want to use and click "Copy Channel ID"

## Configuration

Create a `config` directory with two files:

1. `config.json`:
```json
{
    "discord-bot-token": "your-bot-token-here",
    "discord-channel-id": "your-channel-id-here"
}
```

2. `target.txt`:
- Add the URL of the concert ticket page you want to monitor

## Running with Docker

### Using Pre-built Image

```bash
docker run -d \
  -v "/path/to/your/config:/app/config" \
  -p 2482:8000 \
  maxbraudel/concert-scraper
```

Replace `/path/to/your/config` with the actual path to your config directory containing `config.json` and `target.txt`.

### Building from Source

1. Clone the repository:
```bash
git clone [your-repo-url]
cd concert-scraper
```

2. Build the Docker image:
```bash
docker build -t concert-scraper .
```

3. Run the container:
```bash
docker run -d \
  -v "/path/to/your/config:/app/config" \
  -p 2482:8000 \
  concert-scraper
```

## Docker Image Management

Push container to Docker Hub:
```bash
docker tag concert-scraper maxbraudel/concert-scraper:latest
docker push maxbraudel/concert-scraper:latest
```

## Troubleshooting

- If you're not receiving notifications, check that your bot token and channel ID are correct
- Ensure your config directory is properly mounted in the Docker container
- Check Docker logs for any errors: `docker logs [container-id]`

## License

This plugin is released under the [MIT License](LICENSE).

Copyright 2024 Max Braudel