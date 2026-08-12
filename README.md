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
cp .env.example .env    # прописать ALLOWED_REDMINE_HOSTS
npm run dev
```
