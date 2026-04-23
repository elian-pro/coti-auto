# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

FROM node:20-alpine AS builder
WORKDIR /app
ARG BUILD_TAG=unversioned
ENV BUILD_TAG=${BUILD_TAG}
ENV NEXT_PUBLIC_BUILD_TAG=${BUILD_TAG}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN echo "Building with BUILD_TAG=${BUILD_TAG}" && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ARG BUILD_TAG=unversioned
ENV BUILD_TAG=${BUILD_TAG}
ENV NEXT_PUBLIC_BUILD_TAG=${BUILD_TAG}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "echo \"[coti-auto] starting build ${BUILD_TAG} on port ${PORT}\" && node server.js"]
