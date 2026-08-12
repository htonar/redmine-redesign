# Redmine REST API — спека и клиент

Источник спеки: [d-yoshi/redmine-openapi](https://github.com/d-yoshi/redmine-openapi) —
неофициальная, но живая OpenAPI 3.0.3 спецификация Redmine REST API, собранная из
исходников и офдоков, протестирована против Redmine 7.0.0.

Официальная документация ресурсов: https://www.redmine.org/projects/redmine/wiki/rest_api

Оба готовых npm-клиента (`redmine-ts`, `axios-redmine`) заброшены/deprecated, поэтому
вместо них используется связка **openapi-typescript + openapi-fetch**: типы генерируются
из спеки, а поверх — свой тонкий клиент.

## Структура

- `api/redmine-openapi.yaml` — сама OpenAPI-спека (скачана из релиза `7.0.0-r2`).
- `src/api/schema.d.ts` — сгенерированные TypeScript-типы (не редактировать руками).
- `src/api/client.ts` — фабрика типизированного клиента с авторизацией.

## Обновление спеки / типов

Спеку версионируют релизами вида `<redmine-version>-r<N>`. Чтобы обновить:

```sh
curl -sL -o api/redmine-openapi.yaml \
  https://github.com/d-yoshi/redmine-openapi/releases/latest/download/openapi.yaml
npm run api:generate
```

## Использование клиента

```ts
import { createRedmineClient } from "./src/api/client";

const redmine = createRedmineClient({
  baseUrl: "https://redmine.example.com",
  auth: { apiKey: "YOUR_API_KEY" },
});

const { data, error } = await redmine.GET("/issues.{format}", {
  params: { path: { format: "json" }, query: { limit: 25 } },
});
```

**Важно:** Redmine исторически кодирует формат ответа суффиксом в пути
(`/issues.json`, `/issues.xml`), поэтому в спеке путь выглядит как
`/issues.{format}` и параметр `format: "json"` нужно передавать явно в
каждом вызове.

## Аутентификация

Поддерживается два способа (см. `RedmineAuth` в `client.ts`):

- **API key** (`X-Redmine-API-Key` заголовок) — рекомендуется.
- **HTTP Basic** (`login` + `password`) — используется, если `apiKey` не задан.

Redmine-сервер должен быть доступен из браузера с корректными CORS-заголовками —
это отдельная настройка на стороне Redmine (или прокси на своём бэкенде), не
покрывается фронтовым клиентом.

## Покрытие ресурсов

Спека покрывает все ресурсы из официальной wiki: Issues, Projects, Users,
Time Entries, News, Project Memberships, Issue Relations, Versions, Wiki
Pages, Queries, Attachments, Issue Statuses, Trackers, Enumerations, Issue
Categories, Roles, Groups, Custom Fields, Search, Files, My Account,
Journals.
