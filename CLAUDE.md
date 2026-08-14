# CLAUDE.md

Контекст для работы над проектом - что делаем и почему, чтобы не переоткрывать
решения заново в каждой сессии. Хронология уже сделанного (что было чинено,
как проверялось) - в git-истории и GitHub Issues, не здесь; этот файл только
про актуальную архитектуру и активные правила.

## Что это

Собственный React-фронтенд для Redmine поверх его REST API. Не форк Redmine, не
плагин - отдельное SPA, говорящее с любым Redmine-инстансом через `/xxx.json`
эндпоинты. Дизайн - по мотивам [Behance-концепта](docs/design.md), не штатный UI
Redmine.

## Стек и почему так

- **Vite + React + TypeScript**, npm - стандартный выбор, без экзотики.
- **API-клиент - свой, тонкий, поверх сгенерированных типов**, а не готовая
  npm-библиотека: `redmine-ts` и `axios-redmine` заброшены/deprecated (см.
  [docs/redmine-api.md](docs/redmine-api.md)). Вместо них - OpenAPI-спека
  [d-yoshi/redmine-openapi](https://github.com/d-yoshi/redmine-openapi) →
  `openapi-typescript` (генерация типов) → `openapi-fetch` (рантайм-клиент).
  Спеку обновлять релизами оттуда, не редактировать `schema.d.ts` руками.
- **UI-кит - shadcn/ui на Radix Primitives** + своя тема поверх, под палитру
  из `docs/design.md`.
- `.npmrc`: `legacy-peer-deps=true` - Vite-шаблон на TypeScript 6.0, часть
  экосистемы (`openapi-typescript`, CLI `shadcn`) еще требует `^5.x` в
  peerDependencies. Конфликт версий, не реальная несовместимость - можно
  убрать, когда экосистема догонит TS 6.

## Важное ограничение: авторизация и 2FA

Redmine REST API **не поддерживает интерактивный 2FA-челлендж** - HTTP Basic
по логину/паролю жестко отклоняется сервером (`401`) для аккаунтов с 2FA.
Работает только **API-ключ**. Клиент авторизуется только по API-ключу
(`X-Redmine-API-Key`); логин/пароль поддержан на уровне типов в
`src/api/client.ts` (Basic auth) на случай не-2FA сценариев, но экран логина
в UI предлагает только ввод API-ключа - не строить форму логин/пароль как
основной путь входа.

## CORS и прокси-бэкенд

Redmine не отдает `Access-Control-Allow-Origin` ни на обычный запрос, ни на
preflight `OPTIONS` (нет встроенной поддержки CORS в коре) - прямой fetch из
SPA браузер блокирует. Решение - свой прокси-бэкенд `server/` (Node.js + Hono,
отдельный пакет, не часть фронтового билда):

- Клиент шлет запросы на `${VITE_REDMINE_PROXY_URL}/proxy/...` вместо прямого
  обращения к Redmine, с заголовком `X-Redmine-Target: <baseUrl>` - реализовано
  в `src/api/client.ts` (`proxyUrl` опция) и `src/contexts/AuthContext.tsx`.
- Прокси форвардит запрос 1:1 в целевой Redmine, добавляет CORS-заголовки
  (`hono/cors`, origin из `ALLOWED_ORIGIN`).
- Таргет динамический (любой Redmine), но целевой хост обязан быть в
  `ALLOWED_REDMINE_HOSTS` (см. `server/.env.example`) - иначе прокси
  превращается в открытый SSRF-прокси. Пустой `ALLOWED_REDMINE_HOSTS` -
  fail-closed (прокси отклоняет всё, 500).
- Если `VITE_REDMINE_PROXY_URL` не задан - клиент работает напрямую (локальная
  разработка или инстансы с настроенным CORS).
- Прокси не хранит и не логирует API-ключи - только форвардит заголовок
  `X-Redmine-API-Key` транзитом.
- Логика вынесена в `createApp(config)` (`server/src/app.ts`), тестируемую
  через Hono `app.request()` без реального порта; `server/src/index.ts` -
  тонкий entrypoint (`serve()`).

Запуск для разработки - два процесса: `npm run dev` в корне (фронт) и `npm run
dev` в `server/` (прокси). Оба нужны, чтобы реально сходить в чей-то Redmine.

**В десктоп-сборке (Tauri) прокси не нужен вообще** - см. раздел "Десктоп
(Tauri)" ниже.

## Структура

```
api/redmine-openapi.yaml   # OpenAPI-спека Redmine REST API (источник правды)
src/api/schema.d.ts        # сгенерированные TS-типы - не редактировать руками
src/api/client.ts          # фабрика типизированного клиента (createRedmineClient)
server/                    # прокси-бэкенд для обхода CORS (Node.js + Hono) - только веб-сборка
src-tauri/                 # десктоп-обертка (Tauri/Rust)
docs/redmine-api.md        # как устроена спека/клиент, как обновлять
docs/design.md              # дизайн-язык, палитра, компоненты из референса
docs/permissions.md         # как резолвятся права доступа через REST API
```

## Реализовано

Полнофункциональное SPA поверх REST API Redmine: логин по API-ключу, роутинг
(`/issues`, `/issues/:id`, `/time`, `/dashboard`, `/profile`, `/files`),
список задач (фильтры/сортировка/сохраненные виды/канбан), карточка задачи
(правка, подзадачи и связи, вложения, наблюдатели, custom fields,
markdown-редактор описания/комментариев со вставкой файлов по Ctrl+V, история
изменений), учет времени (просмотр/создание/правка/удаление, виджет
недельного долга по трудозатратам), дашборд с лентой активности, темная тема,
permissions-aware UI (скрытие кнопок без прав, `src/api/permissions.ts`),
глобальный поиск, горячие клавиши (`?` - справка), шаблоны задач,
уведомления (поллинг + in-app бейдж + OS push в десктоп-сборке), Docker-сборка
(`docker-compose.yml`), десктоп-сборка через Tauri с автообновлением.

Детали реализации конкретных фич смотреть в коде и git-истории; открытые
задачи и новые идеи - GitHub Issues (`htonar/redmine-redesign`), не здесь.

## Локальный Redmine для тестирования

`docker-compose.redmine.yml` - одноразовый `redmine:6-alpine` с SQLite, без
внешней БД. `docker compose -f docker-compose.redmine.yml up -d`, затем
`admin/admin` (Redmine попросит сменить пароль при первом входе).

Известный готча: сид-данные (трекеры/приоритеты/статусы) иногда не
подгружаются сами при первом старте контейнера. Симптом - `POST
/issues.json` падает с `422` ("Tracker cannot be blank" и т.п.) даже при
валидных id. Проверяется через `GET /trackers.json` /
`/enumerations/issue_priorities.json` / `/issue_statuses.json` - если все три
`[]`, дело в этом. Чинится: `docker exec -e SECRET_KEY_BASE=<любой> -e
REDMINE_LANG=ru redmine-local bundle exec rake redmine:load_default_data`.
Проект, созданный через веб-UI до этой починки, дополнительно останется без
трекеров - донастроить `PUT /projects/{id}.json` (`tracker_ids`) или через UI.

## Права доступа (permissions)

Единого "что мне можно" эндпоинта в Redmine REST API нет, но резолвить группы
вручную не нужно - алгоритм в [`docs/permissions.md`](docs/permissions.md):
`GET /users/current.json?include=memberships` отдает role id по каждому
проекту (с учетом групп), `GET /roles/{id}.json` отдает `permissions: string[]`
(кэшировать на сессию). `admin: true` с `/my/account.json` обходит все
проверки. Реализация - `src/api/permissions.ts` (`fetchPermissions`),
подключено в `AuthContext` (`can(permission, projectId)`). Клиентская проверка
- это UX, не замена серверной: мутирующие вызовы отдельно ловят `403`.

## Приоритеты

Целевой пользователь - разработчик, который заводит задачи и трекает время;
анализ/отчётность - вторично. Углубление и удобство этого сценария
приоритетнее охвата остальных модулей Redmine, вплоть до выхода за рамки
UI/UX оригинального Redmine (лишь бы оставаться в рамках его REST API).

- **Не гнаться за паритетом с нативным Redmine** - вики, Gantt, репозитории
  осознанно не в фокусе.
- Сайдбар: "Сообщения" (форумы) и "Цели" вырезаны - не в фокусе / нет
  подходящей REST-сущности. Актуальный набор пунктов - `src/components/layout/nav-items.ts`.
- Все кандидаты на новый функционал ведутся как GitHub Issues, не в этом
  файле - см. "Ведение бэклога" ниже.

## Десктоп (Tauri)

Продукт **"Redfine"** (`src-tauri/`, bundle id `com.htonar.redfine`), обертка
выбрана вместо Electron ради веса дистрибутива (системный WebView, не
бандлить Chromium+Node).

- **Прокси не нужен вообще, не sidecar** - CORS есть только на уровне
  браузера/webview; Rust `reqwest` (`src-tauri/src/proxy.rs`, команда
  `proxy_request`) делает обычный исходящий HTTP-запрос без понятия CORS.
  Форвардит 1:1, тот же контракт, что у `/proxy/*` в `server/src/index.ts`.
  Тело - base64 в обе стороны (`src/api/tauriFetch.ts`, `invoke()` умеет
  только JSON-совместимые значения).
- `ALLOWED_REDMINE_HOSTS` в десктоп-сценарии не нужен - Tauri IPC не слушает
  сеть, вызвать команду может только код самого webview.
- Интеграция - `src/api/client.ts`: `isTauri()` определяет режим при создании
  клиента, в Tauri-режиме `fetch` кастомный (`tauriFetch`), `baseUrl` - сразу
  реальный Redmine, без `X-Redmine-Target`. Прокси-сервер (`server/`) не
  участвует в десктоп-сборке вообще - веб/Docker-сборка как была.
- Кроссплатформенность: `reqwest` с `rustls-tls` (без системной OpenSSL),
  `tauri.conf.json` → `bundle.targets: "all"` (nsis для Windows и т.д.).
- **GitHub Actions** (`.github/workflows/desktop-release.yml`) - матрица
  win/macOS/linux через `tauri-apps/tauri-action`, **только ручной запуск**
  (`workflow_dispatch`), версия - обязательный ручной ввод (semver,
  прокидывается в `package.json` через `npm version` и синхронизируется в
  `src-tauri/Cargo.toml` через `scripts/sync-tauri-version.mjs` - Tauri берет
  версию оттуда, а не из `package.json`/`tauri.conf.json`, если она не
  прописана явно в `tauri.conf.json`). Тег `redfine-v<version>`, релиз -
  **draft** (`releaseDraft: true`), не публикуется автоматически.
- **Автообновление** - `tauri-plugin-updater` + `tauri-plugin-process`,
  обновления подписаны локально сгенерированной ключевой парой; приватный
  ключ - только в GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY`), не в
  репозитории. Эндпоинт апдейтера - `releases/latest` GitHub (резолвится
  только в **опубликованный**, не draft, релиз - тот же ручной контроль
  публикации распространяется и на автообновление). Требует публичного
  репозитория (приватные release assets не отдаются апдейтеру без авторизации).
  Фронт - `src/hooks/useAppUpdater.ts`, UI - `UpdateBanner.tsx` + пункт в
  дропдауне пользователя (`Topbar.tsx`).

## Ведение бэклога

Открытые задачи и идеи по расширению приложения ведутся как **GitHub Issues**
в `htonar/redmine-redesign`, не прозой в этом файле - `gh issue list`.
Заводить новые идеи - тоже туда.

## Процесс: TDD

С issue #15 ("Тестовая инфраструктура + рефакторинг под TDD") вся новая
функциональность разрабатывается по TDD: сначала падающий тест, затем
минимальная реализация, затем рефакторинг. Не писать тесты постфактум.

### Тестовая инфраструктура

- **Vitest** для обоих пакетов (фронт и `server/`). Фронт -
  `environment: "jsdom"` + React Testing Library (`@testing-library/react`/
  `jest-dom`/`user-event`), конфиг - `test` в `vite.config.ts`,
  `setupFiles: ["./src/test/setup.ts"]`. `server/` - `environment: "node"`,
  свой `server/vitest.config.ts`. Тесты - `*.test.ts(x)` рядом с исходником,
  явные импорты из `"vitest"` (без `globals: true`). Запуск - `npm test` в
  обоих пакетах (`server/` - также `npm run typecheck`).
- Покрытие целится не в метрику, а в места, где уже ловили реальные баги или
  логика достаточно тонкая для незаметной регрессии: `issue-views-storage.ts`,
  `issue-sort.ts`, `issue-relations.ts` (`describeIssueRelation` - лейбл связи
  с учетом направления, включая зеркальные пары типа `blocks`/`blocked`),
  `issue-form.ts` (`diffFormValues`/`formatCustomFieldValue`), `src/api/issues.ts`
  (`listIssues` - построение query через мок `RedmineClient.GET`),
  `server/src/app.ts` (валидация `X-Redmine-Target`, fail-closed allowlist,
  форвардинг, сетевая ошибка → 502, регрессионный тест на баг с `204`-ответом
  - прокси обязан звать `body.cancel()` перед возвратом пустого тела, иначе
  портится keep-alive соединение и следующий запрос падает `503`).
- **CI** (`.github/workflows/ci.yml`) - `on: push` (main) + `on: pull_request`,
  отдельно от `desktop-release.yml` (только `workflow_dispatch`). Два джоба:
  `frontend` (`npm ci` → lint → build → test) и `server`
  (`working-directory: server`, `npm ci` → typecheck → test).

## Ключевые фичи (то, чем реально пользуются каждый день)

Не декоративные экраны (Gantt, wiki, файлы) - без них продукт не выполняет
основную задачу. Приоритет выше всего остального.

### Список задач: фильтры, сортировка, сохраненные виды

- `GET /issues.json` - основной список. Ключевые фильтры: `project_id`,
  `status_id` (`o` - открытые, `c` - закрытые), `assigned_to_id` (`me` - мои),
  `tracker_id`, `priority_id`, `fixed_version_id`. Сортировка -
  `sort=field:desc,field2`. Пагинация `offset`/`limit` (максимум 100 за раз).
- "Мои задачи" vs "все задачи проекта" - разные пресеты фильтра
  (`assigned_to_id=me` + текущий `project_id`), не отдельная сущность. Дефолт
  при открытии раздела - "мои открытые задачи".
- Сохранение фильтров - два источника:
  1. **Свои сохраненные виды** (не Redmine): имя + сериализованный набор
     фильтров/сортировки. localStorage (ключ по URL инстанса + пользователю) -
     Redmine REST API не дает создавать `Queries` через API, только читать.
  2. **Родные Query Redmine**: `GET /queries.json` - уже созданные в самом
     Redmine query пользователя. `GET /issues.json?query_id=N` применяет их
     фильтры одним параметром (остальные фильтры в этом случае игнорируются).
- `GET /issue_statuses.json`, `/trackers.json`,
  `/enumerations/issue_priorities.json`, `/projects.json` - справочники для
  панели фильтров.

### Учет трудозатрат (time tracking)

- Просмотр: `GET /time_entries.json`, фильтры `user_id=me`, `project_id`,
  `spent_on` либо шорткаты `from`/`to`, `issue_id`. Разбивка по дням - на
  фронте, отдельного summary-эндпоинта в API нет.
- Создание: `POST /time_entries.json` (`issue_id` или `project_id`, `hours`,
  `activity_id`, `spent_on`, `comments`). Быстрый ввод прямо с карточки
  задачи - стандартный сценарий "закрыл кусок работы, сразу залогировал".
- Правка/удаление своей записи: `PUT`/`DELETE /time_entries/{id}.json`.
- Виды деятельности: `GET /enumerations/time_entry_activities.json`.

### Уведомления (issue #3)

REST API Redmine не даёт push/websocket - реализовано поллингом,
раз в 7 минут (середина согласованного диапазона 5-10):
`GET /issues.json?assigned_to_id=me&...` + `...?watcher_id=me&...`, сравнение
со снэпшотом прошлого опроса. Вся сравнивающая логика - чистая функция
`src/lib/notifications.ts` (`diffIssuesForNotifications`, юнит-тесты рядом),
персист снэпшотов/списка уведомлений - `src/lib/notifications-storage.ts`
(localStorage, по образцу `issue-views-storage.ts`), оркестрация (таймер,
fetch) - хук `src/hooks/useNotifications.ts`. Четыре триггера: назначение
задачи на меня, смена статуса своей задачи, активность (новый
комментарий/изменение) по своей или наблюдаемой задаче, приближение
дедлайна (`due_date` в пределах 3 дней, не повторяется, пока дедлайн не
сдвинут). Первый опрос после логина только сидирует снэпшоты молча - не
флудит уведомлениями про то, что уже было.

In-app индикатор - бейдж на иконке-колокольчике в Topbar
(`NotificationsBell.tsx`), одинаково в веб- и десктоп-сборке. OS push -
только в десктоп-сборке (Tauri), `@tauri-apps/plugin-notification`
(`src/lib/os-notifications.ts`), permission запрашивается лениво при первой
отправке.

Интервал опроса и вкл/выкл уведомлений пока константы
(`useNotifications.ts`), не persisted-настройка - пользователь явно попросил
UI для этого отдельным заходом (see issue #3, дальнейшие комментарии). Хук
уже принимает только `client`/`baseUrl`/`userId`, так что добавить
`enabled`/`intervalMs` параметрами можно будет без переписывания диффа и
стораджа.
