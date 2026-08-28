/**
 * Настройка колонок канбан-доски (issue: их слишком много при большом
 * наборе статусов Redmine) - какие показывать и в каком порядке. Чистые
 * функции; персист - kanban-columns-storage.ts, UI - KanbanColumnSettings.
 */

export interface KanbanColumnPrefs {
  /** Порядок отображения по id статуса. Статусы не из списка идут после, в исходном порядке справочника. */
  order: number[];
  /** Скрытые колонки (id статусов) - карточки в этих статусах на доске не показываются. */
  hidden: number[];
}

export const EMPTY_KANBAN_PREFS: KanbanColumnPrefs = { order: [], hidden: [] };

/**
 * Сортирует справочник статусов по prefs.order (стабильно - статусы, которых
 * нет в order, сохраняют исходный относительный порядок и идут в конец).
 */
export function sortStatusesByOrder<T extends { id: number }>(
  statuses: T[],
  order: number[],
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const rankOf = (id: number) =>
    rank.has(id) ? (rank.get(id) as number) : Number.MAX_SAFE_INTEGER;
  return statuses
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rankOf(a.s.id) - rankOf(b.s.id) || a.i - b.i)
    .map((x) => x.s);
}

export function isColumnHidden(prefs: KanbanColumnPrefs, statusId: number): boolean {
  return prefs.hidden.includes(statusId);
}

/** Переставляет элемент массива на одну позицию (dir: -1 вверх/влево, +1 вниз/вправо). */
export function moveInArray<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || index >= arr.length || j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export function toggleHidden(hidden: number[], statusId: number): number[] {
  return hidden.includes(statusId)
    ? hidden.filter((id) => id !== statusId)
    : [...hidden, statusId];
}
