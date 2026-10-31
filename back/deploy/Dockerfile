ARG NODE_VERSION=24.11.0
ARG MIRROR_URL

# Dépendances de production uniquement. Le back s'exécute en TypeScript via `tsx` (dépendance
# de prod) : pas d'étape de transpilation.
FROM ${MIRROR_URL}node:${NODE_VERSION}-slim AS app-build
RUN npm config set audit=false fund=false loglevel=error update-notifier=false
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM ${MIRROR_URL}node:${NODE_VERSION}-slim AS app
RUN apt-get update -qq && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node --from=app-build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node src/main ./src/main

# Base SQLite et cache des miniatures : à monter en volume (voir deploy/compose.yaml).
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4747 \
    DATA_DIR=/data \
    DESKTOP=false
EXPOSE 4747

# Ne pas tourner en root : l'app ne lit les modèles qu'en lecture seule et n'écrit que dans /data.
USER node

CMD ["dumb-init", "node", "--import", "tsx", "src/main/index.ts"]
