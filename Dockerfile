# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG PUBLIC_API_URL
ARG PUBLIC_API_BASE_URL
ARG PUBLIC_SITE_URL
ARG APP_ENV=production
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV APP_ENV=${APP_ENV}

RUN npm run build

# Prune dev dependencies so the already-resolved prod-only tree can be copied
# into the runtime stage. Avoids the flaky, non-deterministic network re-install
# at runtime (no lockfile/cache was available there).
RUN npm prune --omit=dev

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_ENV=development

CMD ["node", "build"]
