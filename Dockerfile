# Сборка фронтенда в статику и раздача через nginx.
#
# VITE_REDMINE_PROXY_URL зашивается в бандл на этапе сборки (Vite инлайнит
# import.meta.env.* в build-time) - поэтому это build arg, а не runtime env
# контейнера. Если адрес прокси меняется, образ нужно пересобрать.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ARG VITE_REDMINE_PROXY_URL=http://localhost:8787
ENV VITE_REDMINE_PROXY_URL=$VITE_REDMINE_PROXY_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
