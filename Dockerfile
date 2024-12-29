# Use the official Node.js image as a base image
FROM node:latest

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
COPY package.json package-lock.json ./

# Install Node.js dependencies
RUN npm install

# Install Puppeteer extra and stealth plugin
RUN npm install puppeteer-extra puppeteer-extra-plugin-stealth

# Install Chrome and dependencies for Puppeteer
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable --no-install-recommends && \
    apt-get purge --auto-remove -y && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variable
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy only necessary code (you could exclude the data file if it's mounted as a volume)
COPY . .

# Run the Node.js app with a watcher (alternatively, set up a file watcher in your script)
CMD ["node", "scraper.js"]
