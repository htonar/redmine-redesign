import {
  EMPTY_LIST_COLUMN_PREFS,
  type ListColumnId,
  type ListColumnPrefs,
} from "@/lib/list-columns";

/**
 * Персист настройки колонок списка задач (list-columns.ts) - по образцу
 * kanban-columns-storage.ts, но ключ без projectId: видимые поля задачи от
 * проекта не зависят (в отличие от рабочих статусов канбана).
 */

function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:list-columns:${baseUrl}:${userId}`;
}

function asIds(value: unknown): ListColumnId[] {
  return Array.isArray(value)
    ? (value.filter((x) => typeof x === "string") as ListColumnId[])
    : [];
}

export function loadListColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
): ListColumnPrefs {
  if (!baseUrl || !userId) return EMPTY_LIST_COLUMN_PREFS;
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return EMPTY_LIST_COLUMN_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<ListColumnPrefs>;
    return { order: asIds(parsed.order), hidden: asIds(parsed.hidden) };
  } catch {
    return EMPTY_LIST_COLUMN_PREFS;
  }
}

export function saveListColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
  prefs: ListColumnPrefs,
): void {
  if (!baseUrl || !userId) return;
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(prefs));
}
