import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

// Тонкий entrypoint: читает конфиг из process.env и поднимает реальный
// сетевой listener. Вся логика роутов - в app.ts (createApp), это разделение
// и позволяет тестировать роуты через Hono's app.request(...) без порта.

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5183";
const ALLOWED_REDMINE_HOSTS = (process.env.ALLOWED_REDMINE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const app = createApp({
  allowedOrigin: ALLOWED_ORIGIN,
  allowedRedmineHosts: ALLOWED_REDMINE_HOSTS,
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`redmine-proxy слушает на http://localhost:${info.port}`);
  if (ALLOWED_REDMINE_HOSTS.length === 0) {
    console.warn(
      "ВНИМАНИЕ: ALLOWED_REDMINE_HOSTS не задан - все запросы будут отклонены (403/500).",
    );
  }
});
