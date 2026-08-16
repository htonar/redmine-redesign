import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Универсальный прокси для обхода CORS - изначально только для Redmine, с
 * issue #22 (шаг 2) расширен на GitHub/GitLab (нужен только GitLab - у
 * GitHub REST API CORS есть из коробки, см. docs, живой статус PR/MR идёт
 * туда прямым fetch без прокси).
 *
 * Redmine (по крайней мере в дефолтной конфигурации, см. CLAUDE.md) не отдает
 * Access-Control-Allow-Origin ни на обычные запросы, ни на preflight; GitLab
 * REST API не отдает их вообще ни при какой конфигурации (открытый issue у
 * них с 2016 - gitlab-org/gitlab-foss#24596) - в обоих случаях браузер
 * блокирует прямой fetch из SPA. Этот сервис ничего не знает про целевой
 * домен заранее: клиент указывает адрес в заголовке X-Proxy-Target (базовый
 * URL Redmine-инстанса, или https://gitlab.com / self-hosted GitLab),
 * прокси форвардит запрос туда 1:1 и добавляет CORS-заголовки в ответе.
 *
 * Один механизм на все три цели (Redmine/GitHub-не нужен/GitLab), не
 * отдельные маршруты - так решили в грилинге к issue #22 шагу 2: меньше
 * кода, единая точка форвардинга. Разграничение по-прежнему на уровне
 * allowlist: чтобы не превращать сервис в открытый SSRF-прокси, целевой хост
 * обязан быть в ALLOWED_PROXY_HOSTS - без явного разрешения запрос
 * отклоняется, независимо от того, Redmine это или GitLab.
 *
 * Логика роутов вынесена в createApp(config) отдельно от index.ts (тонкий
 * entrypoint, читает process.env и вызывает serve()) - чтобы тестировать
 * роуты через Hono's app.request(...), без реального сетевого порта.
 */

export interface AppConfig {
  allowedOrigin: string;
  allowedProxyHosts: string[];
}

const FORWARDED_REQUEST_HEADERS = [
  "x-redmine-api-key",
  "authorization",
  "content-type",
  "x-redmine-switch-user",
  // GitLab REST API - см. issue #22, шаг 2 (живой статус MR).
  "private-token",
];

export function createApp(config: AppConfig): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: config.allowedOrigin,
      allowHeaders: [
        "Content-Type",
        "X-Redmine-API-Key",
        "Private-Token",
        "X-Proxy-Target",
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.all("/proxy/*", async (c) => {
    const targetHeader = c.req.header("X-Proxy-Target");
    if (!targetHeader) {
      return c.json({ error: "Заголовок X-Proxy-Target обязателен." }, 400);
    }

    let target: URL;
    try {
      target = new URL(targetHeader);
    } catch {
      return c.json({ error: "X-Proxy-Target - не валидный URL." }, 400);
    }

    const isLocalHost =
      target.hostname === "localhost" || target.hostname === "127.0.0.1";
    if (target.protocol !== "https:" && !isLocalHost) {
      return c.json({ error: "Целевой хост должен быть по https." }, 400);
    }

    if (config.allowedProxyHosts.length === 0) {
      return c.json(
        { error: "Прокси не настроен: ALLOWED_PROXY_HOSTS пуст на сервере." },
        500,
      );
    }
    if (!config.allowedProxyHosts.includes(target.hostname)) {
      return c.json(
        { error: `Хост "${target.hostname}" не в списке разрешенных.` },
        403,
      );
    }

    const incomingUrl = new URL(c.req.url);
    const path = incomingUrl.pathname.replace(/^\/proxy/, "");
    const forwardUrl = new URL(path + incomingUrl.search, target);

    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = c.req.header(name);
      if (value) headers.set(name, value);
    }

    const hasBody = !["GET", "HEAD"].includes(c.req.method);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(forwardUrl, {
        method: c.req.method,
        headers,
        body: hasBody ? await c.req.arrayBuffer() : undefined,
      });
    } catch (err) {
      console.error("Ошибка запроса к Redmine:", err);
      return c.json({ error: "Не удалось связаться с Redmine." }, 502);
    }

    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    // 204/205/304 обязаны идти с пустым телом - Response-конструктор в Node
    // (undici) кидает исключение, если передать body (даже пустой
    // ReadableStream - upstreamResponse.body им и является всегда, не null)
    // вместе с таким статусом. Без этой развилки любой такой ответ Redmine
    // (например DELETE .../watchers/{id}.json, который в норме отвечает 204)
    // ронял прокси и клиент вместо реального статуса видел 503, хотя запрос
    // на самом деле выполнился.
    const isEmptyBodyStatus = [204, 205, 304].includes(upstreamResponse.status);

    if (isEmptyBodyStatus) {
      // Просто отбросить upstreamResponse.body (ReadableStream) недостаточно -
      // undici не считает соединение свободным, пока поток тела явно не
      // прочитан или не отменен. Оставленный "висеть" поток порчит keep-alive
      // соединение в пуле, и уже СЛЕДУЮЩИЙ запрос через него падает - отсюда
      // была нестабильность: одни и те же вотчер-запросы отвечали то 204, то
      // 503 без единой закономерности в коде. Явная отмена возвращает
      // соединение в пул чистым.
      await upstreamResponse.body?.cancel();
    }

    return new Response(isEmptyBodyStatus ? null : upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  });

  return app;
}
