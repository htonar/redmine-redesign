const STORAGE_KEY = "redmine-client:auth";

export interface StoredCredentials {
  /** Базовый URL Redmine-инстанса, без завершающего слэша. */
  baseUrl: string;
  apiKey: string;
}

/** Убирает завершающий слэш и лишние пробелы у URL инстанса. */
export function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, "");
}

export function loadCredentials(): StoredCredentials | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    if (typeof parsed.baseUrl === "string" && typeof parsed.apiKey === "string") {
      return { baseUrl: parsed.baseUrl, apiKey: parsed.apiKey };
    }
  } catch {
    // поврежденные данные в сторадже - считаем что их нет
  }
  return null;
}

export function saveCredentials(credentials: StoredCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}
