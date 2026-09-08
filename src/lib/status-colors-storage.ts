import {
  isStatusColorChoice,
  normalizeStatusName,
  type StatusColorMap,
} from "@/lib/status-colors";

/**
 * Персист ручной настройки тонов статусов (issue #65) - тот же паттерн, что
 * list-columns-storage.ts: localStorage, ключ по baseUrl+user, ничего не
 * уходит на сервер.
 */

function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:status-colors:${baseUrl}:${userId}`;
}

export function loadStatusColors(
  baseUrl: string | null,
  userId: number | undefined,
): StatusColorMap {
  if (!baseUrl || !userId) return {};
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: StatusColorMap = {};
    for (const [name, choice] of Object.entries(parsed as Record<string, unknown>)) {
      const key = normalizeStatusName(name);
      if (key && isStatusColorChoice(choice)) out[key] = choice;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStatusColors(
  baseUrl: string | null,
  userId: number | undefined,
  map: StatusColorMap,
): void {
  if (!baseUrl || !userId) return;
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(map));
}
