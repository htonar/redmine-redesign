# Redmine Client

Свой фронтенд для [Redmine](https://www.redmine.org/) поверх его REST API -
переосмысленный UI (см. [дизайн-концепт](docs/design.md)), собственный React-клиент
вместо стандартного Rails-интерфейса Redmine.

## Стек

- **React 19 + TypeScript**, сборка на **Vite**
- **openapi-typescript + openapi-fetch** - типизированный клиент к Redmine REST API,
  сгенерированный из неофициальной OpenAPI-спеки
  ([d-yoshi/redmine-openapi](https://github.com/d-yoshi/redmine-openapi))
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
docs/                      # спека API, дизайн-документация
```

## Разработка

```sh
npm install
npm run dev            # dev-сервер
npm run build           # tsc -b && vite build
npm run lint             # oxlint
npm run api:generate    # перегенерировать TS-типы из api/redmine-openapi.yaml
```
