# 🔴 Satu versi Node untuk kedua tahap, dipatok ke rilis patch — bukan tag
# mengambang `node:<major>-alpine`. Tahap runtime menjalankan server SSR publik,
# jadi versinya harus pasti sudah memuat perbaikan keamanan.
#
# Node 20 sudah EOL (30 Apr 2026) dan tidak lagi menerima perbaikan; rilis
# keamanan 21 Okt 2026 (Brotli/zlib, DNS, TLS, keep-alive http) baru tertutup di
# 22.23.4. Naikkan angka ini setiap ada rilis keamanan Node 22 berikutnya.
ARG NODE_VERSION=22.23.4

# Stage 1: Builder
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# 🔴 Lockfile WAJIB ikut, dan pemasangannya `npm ci` — bukan `npm install`.
#
# Sebelumnya hanya `package.json` yang disalin, jadi npm menyusun ulang seluruh
# pohon dependensi dari registry setiap kali build. Itu bukan cuma tidak
# deterministik; pada 25 Agustus 2026 ia benar-benar menjatuhkan deploy:
#
#   npm error Cannot read properties of null (reading 'edgesOut')
#
# Bug arborist di npm 10.8.2 — versi yang dibawa `node:20-alpine`. Diukur di
# image dengan digest yang sama persis dengan yang dipakai deploy
# (sha256:fb4cd12c…): `npm install` tanpa lockfile keluar dengan kode 1,
# `npm ci` dengan lockfile keluar dengan kode 0.
#
# ⚠️ Ini juga menutup lubang yang sudah disebut komentar `npm prune` di bawah:
# ia mengeluhkan "flaky, non-deterministic network re-install" untuk tahap
# runtime, padahal tahap builder-nya sendiri mengidap penyakit yang sama.
COPY package.json package-lock.json ./
RUN npm ci

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
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY cluster.mjs ./

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_ENV=development
# SSR opens scale across cores via the cluster wrapper (default 2 workers).
ENV WEB_CONCURRENCY=2

CMD ["node", "cluster.mjs"]
