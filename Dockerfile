FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose the port Render uses
EXPOSE 3000

# Start the application
CMD ["npm", "start"]