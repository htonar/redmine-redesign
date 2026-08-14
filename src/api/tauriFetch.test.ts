// @vitest-environment node
//
// Тест не про DOM, а про поведение самого Response (Fetch API) - jsdom-овская
// реализация Response не совпадает с браузерной/Chromium (WebView2, в котором
// реально работает Tauri) ни по тексту ошибки на null-body статусах, ни по
// чтению Blob-тела - node-окружение здесь ближе к реальности (нативный
// fetch/Response на undici, тот же движок, что в WebView2/Chrome).
import { describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { tauriFetch } = await import("./tauriFetch");

describe("tauriFetch", () => {
  it("не падает на статусах с запрещенным телом (204 No Content)", async () => {
    // Смена статуса задачи - PUT /issues/{id}.json - отвечает 204 без тела.
    // Response с null-body статусом (204/205/304) не может принимать body -
    // даже пустой Blob считается "телом" и Response() бросает исключение.
    invokeMock.mockResolvedValueOnce({
      status: 204,
      content_type: null,
      body_base64: "",
    });

    const response = await tauriFetch(
      new Request("https://redmine.example.com/issues/1.json", {
        method: "PUT",
        body: JSON.stringify({ issue: { status_id: 2 } }),
      }),
    );

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it("возвращает тело как обычно для статусов, допускающих body", async () => {
    invokeMock.mockResolvedValueOnce({
      status: 200,
      content_type: "application/json",
      body_base64: btoa(JSON.stringify({ ok: true })),
    });

    const response = await tauriFetch(
      new Request("https://redmine.example.com/issues.json"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
