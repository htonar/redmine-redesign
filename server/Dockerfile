# Прокси-бэкенд (обход CORS, см. CLAUDE.md). Отдельный npm-пакет, свой образ.
#
# Проект не компилируется в JS отдельным шагом (tsconfig.json - noEmit,
# используется только для проверки типов), "start" запускает исходники прямо
# через tsx - тот же способ переносим в контейнер.

FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./

EXPOSE 8787
CMD ["npm", "run", "start"]
