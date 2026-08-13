import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Прокси для обхода CORS на стороне Redmine-сервера.
 *
 * Redmine (по крайней мере в дефолтной конфигурации, см. CLAUDE.md) не отдает
 * Access-Control-Allow-Origin ни на обычные запросы, ни на preflight - браузер
 * блокирует прямые запросы SPA к нему. Этот сервис ничего не знает про домен
 * Redmine заранее: клиент указывает целевой инстанс в заголовке
 * X-Redmine-Target (тот же адрес, что пользователь вводит на экране логина),
 * прокси форвардит запрос туда 1:1 и добавляет CORS-заголовки в ответе.
 *
 * Чтобы не превращать сервис в открытый SSRF-прокси, целевой хост обязан быть
 * в ALLOWED_REDMINE_HOSTS - без явного разрешения запрос отклоняется.
 */

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5183";
const ALLOWED_REDMINE_HOSTS = (process.env.ALLOWED_REDMINE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const FORWARDED_REQUEST_HEADERS = [
  "x-redmine-api-key",
  "authorization",
  "content-type",
  "x-redmine-switch-user",
];

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ALLOWED_ORIGIN,
    allowHeaders: ["Content-Type", "X-Redmine-API-Key", "X-Redmine-Target"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/healthz", (c) => c.json({ ok: true }));

app.all("/proxy/*", async (c) => {
  const targetHeader = c.req.header("X-Redmine-Target");
  if (!targetHeader) {
    return c.json({ error: "Заголовок X-Redmine-Target обязателен." }, 400);
  }

  let target: URL;
  try {
    target = new URL(targetHeader);
  } catch {
    return c.json({ error: "X-Redmine-Target - не валидный URL." }, 400);
  }

  const isLocalHost = target.hostname === "localhost" || target.hostname === "127.0.0.1";
  if (target.protocol !== "https:" && !isLocalHost) {
    return c.json({ error: "Целевой инстанс должен быть по https." }, 400);
  }

  if (ALLOWED_REDMINE_HOSTS.length === 0) {
    return c.json(
      { error: "Прокси не настроен: ALLOWED_REDMINE_HOSTS пуст на сервере." },
      500,
    );
  }
  if (!ALLOWED_REDMINE_HOSTS.includes(target.hostname)) {
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

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`redmine-proxy слушает на http://localhost:${info.port}`);
  if (ALLOWED_REDMINE_HOSTS.length === 0) {
    console.warn(
      "ВНИМАНИЕ: ALLOWED_REDMINE_HOSTS не задан - все запросы будут отклонены (403/500).",
    );
  }
});
