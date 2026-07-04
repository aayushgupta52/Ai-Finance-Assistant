FROM node:20-slim

# System deps for Prisma (openssl) and Sharp/OCR image processing
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifest + Prisma schema first so `npm ci` (postinstall: prisma generate)
# can find the schema and the layer caches on dependency changes only.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/server.js"]
