export type PersistedStateKey = "selected-project" | "issues-filters" | "time-range";

/**
 * Персист состояния приложения между перезапусками (issue #6) - выбранный
 * проект, фильтры/сортировка списка задач, период на странице учета времени.
 * Не сущности Redmine, серверного аналога нет - localStorage, по образцу
 * issue-views-storage.ts. Ключ включает baseUrl и id пользователя - состояние
 * одного Redmine-аккаунта не должно просачиваться в другой при переключении
 * логина на этом же устройстве.
 */
function storageKey(baseUrl: string, userId: number, key: PersistedStateKey): string {
  return `redmine-client:state:${key}:${baseUrl}:${userId}`;
}

export function loadPersistedState<T>(
  baseUrl: string,
  userId: number,
  key: PersistedStateKey,
  fallback: T,
): T {
  const raw = localStorage.getItem(storageKey(baseUrl, userId, key));
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function savePersistedState<T>(
  baseUrl: string,
  userId: number,
  key: PersistedStateKey,
  value: T,
): void {
  localStorage.setItem(storageKey(baseUrl, userId, key), JSON.stringify(value));
}
