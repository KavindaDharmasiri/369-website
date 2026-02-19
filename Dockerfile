FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV DATABASE_URL="mysql://avnadmin:AVNS_GLHz1hb36oM_ixcUxRX@mysql-1c6c42ff-kavindadarmasiri15-197a.g.aivencloud.com:25939/defaultdb?ssl-mode=REQUIRED"
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
