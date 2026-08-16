/**
 * Настройки AI-ассистента (issue #23) - base_url/api_key/model для
 * универсального OpenAI-совместимого клиента (src/api/ai.ts). Хранение -
 * тот же паттерн, что integration-tokens-storage.ts для GitHub/GitLab
 * токенов: только localStorage, ничего не уходит на сервер/прокси.
 */

const STORAGE_KEY = "redmine-client:ai-settings";

export interface AiSettingsStored {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export function loadAiSettings(): AiSettingsStored {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<AiSettingsStored>;
    const result: AiSettingsStored = {};
    if (typeof parsed.baseUrl === "string") result.baseUrl = parsed.baseUrl;
    if (typeof parsed.apiKey === "string") result.apiKey = parsed.apiKey;
    if (typeof parsed.model === "string") result.model = parsed.model;
    return result;
  } catch {
    // поврежденные данные в сторадже - считаем что их нет
  }
  return {};
}

export function saveAiSettings(settings: AiSettingsStored): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAiConfigured(
  settings: AiSettingsStored,
): settings is Required<AiSettingsStored> {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model);
}
