FROM debian:bookworm-slim AS libredwg-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates build-essential autoconf automake libtool pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch 0.13.4 https://github.com/LibreDWG/libredwg.git . \
    && sh ./autogen.sh \
    && ./configure --prefix=/opt/libredwg --disable-bindings --disable-shared --enable-release \
    && make -j2 \
    && make install

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
ENV DATABASE_URL="postgresql://build_user:build_password@localhost:5432/build_database?schema=public"
RUN npx prisma generate && npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    libreoffice-core-nogui libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui libreoffice-draw-nogui \
    fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
COPY --from=libredwg-builder /opt/libredwg /opt/libredwg
ENV PATH="/opt/libredwg/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/libredwg/lib:${LD_LIBRARY_PATH}"
ENV NODE_ENV=production
ENV HOME=/tmp/coffria-home
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
