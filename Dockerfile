FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

ENV DATA_DIR=/app/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
