ARG NODE_VERSION=24.11.0
ARG MIRROR_URL

FROM ${MIRROR_URL}node:${NODE_VERSION} AS app-build
RUN npm config set audit=false fund=false loglevel=error update-notifier=false
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# nginx sert le front et relaie /api vers le back (réseau interne) : un seul domaine exposé.
FROM nginx:1.27-alpine AS app
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=app-build /usr/src/app/dist/ /usr/share/nginx/html/
EXPOSE 80
