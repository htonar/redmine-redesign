# Redmine Client

Свой фронтенд для [Redmine](https://www.redmine.org/) поверх его REST API -
переосмысленный UI (см. [дизайн-концепт](docs/design.md)), собственный React-клиент
вместо стандартного Rails-интерфейса Redmine.

## Стек

- **React 19 + TypeScript**, сборка на **Vite**
- **openapi-typescript + openapi-fetch** - типизированный клиент к Redmine REST API,
  сгенерированный из неофициальной OpenAPI-спеки
  ([d-yoshi/redmine-openapi](https://github.com/d-yoshi/redmine-openapi))
- **Tailwind CSS v4 + shadcn/ui (Radix Primitives)** - UI-компоненты, тема настроена
  под дизайн-референс (см. [`docs/design.md`](docs/design.md))
- **Node.js + Hono** (`server/`) - прокси-бэкенд, обходит отсутствие CORS у
  Redmine (см. [`CLAUDE.md`](CLAUDE.md), раздел "CORS и прокси-бэкенд")
- **oxlint** - линтер

## Документация проекта

- [`CLAUDE.md`](CLAUDE.md) - контекст для разработки: архитектурные решения,
  ограничения Redmine API, статус задач
- [`docs/redmine-api.md`](docs/redmine-api.md) - спека REST API, генерация типов,
  устройство клиента, аутентификация
- [`docs/design.md`](docs/design.md) - дизайн-язык интерфейса (референс, палитра,
  компоненты, лейаут)

## Структура

```
api/redmine-openapi.yaml   # OpenAPI-спека Redmine REST API
src/api/schema.d.ts        # сгенерированные TS-типы (не редактировать руками)
src/api/client.ts          # фабрика типизированного клиента
src/components/ui/         # shadcn/ui примитивы (кнопки, dropdown, карточки...)
src/components/layout/     # Sidebar, Topbar, AppShell
src/index.css              # тема (токены цвета/шрифта), см. docs/design.md
server/                    # прокси-бэкенд (обход CORS), отдельный npm-пакет
docs/                      # спека API, дизайн-документация
```

## Разработка

Фронтенд:

```sh
npm install
cp .env.example .env    # VITE_REDMINE_PROXY_URL, если нужен прокси (см. ниже)
npm run dev              # dev-сервер
npm run build             # tsc -b && vite build
npm run lint               # oxlint
npm run api:generate      # перегенерировать TS-типы из api/redmine-openapi.yaml
```

Прокси-бэкенд (нужен почти всегда - см.
[`CLAUDE.md`](CLAUDE.md#cors-и-прокси-бэкенд), у Redmine обычно нет CORS):

```sh
cd server
npm install
cp .env.example .env    # прописать ALLOWED_PROXY_HOSTS
npm run dev
```

## Docker

Каждая часть собирается в отдельный образ:

- `Dockerfile` (корень) - фронтенд, multi-stage сборка (`vite build`) + nginx для
  раздачи статики. Адрес прокси зашивается на этапе сборки через build arg
  `VITE_REDMINE_PROXY_URL` (Vite инлайнит `import.meta.env.*` при билде).
- `server/Dockerfile` - прокси-бэкенд, запускает исходники через `tsx` (как и
  `npm run start` локально - отдельного шага компиляции в проекте нет).

Полное окружение для тестирования (свой Redmine + прокси + фронт) - через
`docker-compose.yml`:

```sh
docker compose up --build
```

Поднимает: `redmine` (localhost:3000) + `redmine-db` (Postgres) + `proxy`
(localhost:8787) + `frontend` (localhost:8080). После первого старта Redmine:

1. `http://localhost:3000`, логин `admin`/`admin`, Redmine попросит сменить пароль.
2. Включить REST API: Administration -> Settings -> API -> "Enable REST API".
3. Получить API-ключ: My account -> API access key.
4. Открыть `http://localhost:8080`, на экране логина указать
   `http://localhost:3000` и полученный API-ключ.

Подробности по сетевой схеме (почему `proxy` подключен через
`network_mode: service:redmine`) - в комментариях `docker-compose.yml`.
