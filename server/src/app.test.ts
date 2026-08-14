import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

const CONFIG = {
  allowedOrigin: "http://localhost:5183",
  allowedRedmineHosts: ["redmine.example.com"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/proxy/*", () => {
  it("без X-Redmine-Target - 400", async () => {
    const app = createApp(CONFIG);
    const res = await app.request("/proxy/issues.json");
    expect(res.status).toBe(400);
  });

  it("невалидный URL в X-Redmine-Target - 400", async () => {
    const app = createApp(CONFIG);
    const res = await app.request("/proxy/issues.json", {
      // Заголовок - ByteString (Fetch API), кириллица сюда не пройдёт вовсе -
      // берём ASCII-строку, невалидную именно как URL.
      headers: { "X-Redmine-Target": "not a valid url" },
    });
    expect(res.status).toBe(400);
  });

  it("не-https и не-localhost - 400", async () => {
    const app = createApp(CONFIG);
    const res = await app.request("/proxy/issues.json", {
      headers: { "X-Redmine-Target": "http://redmine.example.com" },
    });
    expect(res.status).toBe(400);
  });

  it("http на localhost - разрешен (проходит валидацию, дальше зависит от allowlist)", async () => {
    const app = createApp({
      allowedOrigin: CONFIG.allowedOrigin,
      allowedRedmineHosts: ["localhost"],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await app.request("/proxy/issues.json", {
      headers: { "X-Redmine-Target": "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
  });

  it("пустой allowedRedmineHosts - 500 (fail-closed)", async () => {
    const app = createApp({ allowedOrigin: CONFIG.allowedOrigin, allowedRedmineHosts: [] });
    const res = await app.request("/proxy/issues.json", {
      headers: { "X-Redmine-Target": "https://redmine.example.com" },
    });
    expect(res.status).toBe(500);
  });

  it("хост не в allowlist - 403", async () => {
    const app = createApp(CONFIG);
    const res = await app.request("/proxy/issues.json", {
      headers: { "X-Redmine-Target": "https://other-redmine.example.com" },
    });
    expect(res.status).toBe(403);
  });

  it("успешный форвард - метод/путь/заголовки/тело доходят до Redmine как есть", async () => {
    const app = createApp(CONFIG);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/proxy/issues.json?foo=bar", {
      method: "POST",
      headers: {
        "X-Redmine-Target": "https://redmine.example.com",
        "X-Redmine-API-Key": "secret-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ issue: { subject: "test" } }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [forwardUrl, init] = fetchMock.mock.calls[0];
    expect(String(forwardUrl)).toBe(
      "https://redmine.example.com/issues.json?foo=bar",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.get("x-redmine-api-key")).toBe("secret-key");
    expect(init.headers.get("content-type")).toBe("application/json");
  });

  it("апстрим недоступен (сетевая ошибка) - 502, не необработанное исключение", async () => {
    const app = createApp(CONFIG);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const res = await app.request("/proxy/issues.json", {
      headers: { "X-Redmine-Target": "https://redmine.example.com" },
    });
    expect(res.status).toBe(502);
  });

  it("регрессия: 204 от Redmine - проксируется как 204 с пустым телом, поток тела отменяется", async () => {
    const app = createApp(CONFIG);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const upstreamResponse = new Response(null, { status: 204 });
    // Подменяем body на объект-шпион, чтобы убедиться, что прокси реально
    // зовёт cancel() - тот самый фикс исторического 204/keep-alive бага
    // (см. CLAUDE.md, раздел "Наблюдатели").
    Object.defineProperty(upstreamResponse, "body", {
      value: { cancel },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamResponse));

    const res = await app.request("/proxy/issues/1/watchers/2.json", {
      method: "DELETE",
      headers: { "X-Redmine-Target": "https://redmine.example.com" },
    });

    expect(res.status).toBe(204);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(await res.arrayBuffer()).toEqual(new ArrayBuffer(0));
  });
});

describe("/healthz", () => {
  it("отвечает 200", async () => {
    const app = createApp(CONFIG);
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
  });
});
