# Admin Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

ARG API_URL=https://nova-agenda-production.up.railway.app
ARG NEXT_PUBLIC_CLIENT_PORTAL_URL=https://delightful-encouragement-production.up.railway.app
ENV API_URL=${API_URL}
ENV NEXT_PUBLIC_API_URL=${API_URL}
ENV NEXT_PUBLIC_CLIENT_PORTAL_URL=https://delightful-encouragement-production.up.railway.app${NEXT_PUBLIC_CLIENT_PORTAL_URL}

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/next.config.js ./
COPY --from=base /app/public ./public

ENV API_URL=https://nova-agenda-production.up.railway.app
ENV NEXT_PUBLIC_API_URL=https://nova-agenda-production.up.railway.app
ENV NEXT_PUBLIC_CLIENT_PORTAL_URL=https://delightful-encouragement-production.up.railway.app
ENV NODE_ENV=production

EXPOSE 3002
CMD ["sh", "-c", "npm start -- -p ${PORT:-3002}"]
