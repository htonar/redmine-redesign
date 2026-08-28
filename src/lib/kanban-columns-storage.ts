/**
 * Персист настройки колонок канбана (kanban-columns.ts) - по образцу
 * issue-views-storage.ts. Ключ включает baseUrl, id пользователя и id
 * проекта: набор рабочих статусов на практике зависит от проекта
 * (workflow), поэтому настройка колонок - тоже.
 */

import {
  EMPTY_KANBAN_PREFS,
  type KanbanColumnPrefs,
} from "@/lib/kanban-columns";

function storageKey(baseUrl: string, userId: number, projectId: number): string {
  return `redmine-client:kanban-columns:${baseUrl}:${userId}:${projectId}`;
}

export function loadKanbanColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
  projectId: number,
): KanbanColumnPrefs {
  if (!baseUrl || !userId) return EMPTY_KANBAN_PREFS;
  const raw = localStorage.getItem(storageKey(baseUrl, userId, projectId));
  if (!raw) return EMPTY_KANBAN_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<KanbanColumnPrefs>;
    return {
      order: Array.isArray(parsed.order)
        ? parsed.order.filter((x): x is number => typeof x === "number")
        : [],
      hidden: Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((x): x is number => typeof x === "number")
        : [],
    };
  } catch {
    return EMPTY_KANBAN_PREFS;
  }
}

export function saveKanbanColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
  projectId: number,
  prefs: KanbanColumnPrefs,
): void {
  if (!baseUrl || !userId) return;
  localStorage.setItem(
    storageKey(baseUrl, userId, projectId),
    JSON.stringify(prefs),
  );
}
