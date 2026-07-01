FROM node:20-alpine
WORKDIR /app

# Install npm
RUN corepack enable && corepack prepare npm@10 --activate

# Copy workspace root
COPY package.json turbo.json ./

# Copy all package.json files
COPY packages/api/package.json ./packages/api/
COPY packages/admin/package.json ./packages/admin/
COPY packages/nova-agenda-website/package.json ./packages/nova-agenda-website/
COPY packages/client-sites/package.json ./packages/client-sites/

# Install all dependencies
RUN npm install

# Copy source
COPY packages/api/ ./packages/api/
COPY packages/admin/ ./packages/admin/
COPY packages/nova-agenda-website/ ./packages/nova-agenda-website/
COPY packages/client-sites/ ./packages/client-sites/

# Generate Prisma
RUN cd packages/api && npx prisma generate

# Build all
RUN npm run build

# Production
FROM node:20-alpine
WORKDIR /app
COPY --from=0 /app ./

EXPOSE 3001 3002 3003 3004

CMD ["npm", "run", "dev"]
