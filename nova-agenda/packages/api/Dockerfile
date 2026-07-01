# API Dockerfile - runs from packages/api/ context
FROM node:20-alpine AS base
WORKDIR /app

# Copy package.json and prisma
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
