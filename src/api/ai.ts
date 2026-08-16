/**
 * Тонкий переиспользуемый AI-клиент - issue #23. Универсальный BYO-key
 * клиент по OpenAI-совместимой chat/completions схеме, а не привязка к
 * конкретному провайдеру - настройки (base_url/api_key/model) целиком
 * вводит пользователь, см. src/lib/ai-settings-storage.ts.
 *
 * Прокси (server/) не участвует - OpenAI/Anthropic/Gemini/OpenRouter сами
 * отдают CORS-заголовки, запрос идет прямым fetch() из браузера (и в вебе,
 * и в Tauri).
 *
 * Первый потребитель - TL;DR обсуждения задачи (src/lib/ai-tldr-prompt.ts).
 */

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiMessage {
  role: "system" | "user";
  content: string;
}

export type AiChatError =
  | { kind: "invalid_key" }
  | { kind: "rate_limited" }
  | { kind: "network" }
  | { kind: "unknown"; status: number };

export type AiChatResult = { ok: true; text: string } | { ok: false; error: AiChatError };

export async function chatCompletion(
  settings: AiSettings,
  messages: AiMessage[],
): Promise<AiChatResult> {
  const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: settings.model, messages }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: { kind: "invalid_key" } };
      }
      if (response.status === 429) {
        return { ok: false, error: { kind: "rate_limited" } };
      }
      return { ok: false, error: { kind: "unknown", status: response.status } };
    }

    const data: unknown = await response.json();
    const text = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]
      ?.message?.content;
    if (typeof text !== "string") {
      return { ok: false, error: { kind: "network" } };
    }

    return { ok: true, text: text.trim() };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}
