import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, type AiSettings } from "./ai";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const settings: AiSettings = {
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "test-key",
  model: "test-model",
};

const messages = [
  { role: "system" as const, content: "system prompt" },
  { role: "user" as const, content: "user text" },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("chatCompletion", () => {
  it("возвращает текст ответа при успешном запросе", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "  краткое саммари  " } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: true, text: "краткое саммари" });
  });

  it("шлет POST на {baseUrl}/chat/completions с моделью, сообщениями и Bearer-заголовком", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletion(settings, messages);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "test-model",
      messages,
    });
  });

  it("нормализует хвостовой слэш в baseUrl", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletion({ ...settings, baseUrl: "https://openrouter.ai/api/v1/" }, messages);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("401 -> invalid_key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "invalid_key" } });
  });

  it("403 -> invalid_key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "forbidden" }, 403));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "invalid_key" } });
  });

  it("429 -> rate_limited", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "too many requests" }, 429));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "rate_limited" } });
  });

  it("прочий не-ok статус -> unknown с кодом статуса", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "unknown", status: 500 } });
  });

  it("сетевая ошибка (fetch reject) -> network", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "network" } });
  });

  it("невалидное тело успешного ответа (нет choices) -> network", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ nonsense: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion(settings, messages);

    expect(result).toEqual({ ok: false, error: { kind: "network" } });
  });
});
