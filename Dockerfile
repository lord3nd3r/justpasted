FROM node:18-alpine

WORKDIR /usr/src/app

# Install production dependencies first
COPY package*.json ./
RUN npm ci --only=production

# Copy app sources
COPY . .

ENV HTTP_PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
