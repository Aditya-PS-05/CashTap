FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile || pnpm install

# Generate Prisma client
RUN pnpm db:generate

# Copy source and build
COPY . .
RUN pnpm build

# Production image
FROM node:20-slim AS production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3456

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
