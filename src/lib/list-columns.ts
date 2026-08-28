import { moveInArray } from "@/lib/kanban-columns";

/**
 * Настраиваемые колонки списка задач (issue #56) - какие показывать и в
 * каком порядке. Чистые функции; персист - list-columns-storage.ts (по
 * baseUrl+user, не по проекту - набор полей задачи от проекта не зависит),
 * UI - ListColumnSettings.
 */

export type ListColumnId =
  | "id"
  | "subject"
  | "tracker"
  | "priority"
  | "status"
  | "assigned_to"
  | "updated_on"
  | "project"
  | "due_date"
  | "done_ratio"
  | "category"
  | "fixed_version"
  | "start_date"
  | "estimated_hours"
  | "spent_hours";

export interface ListColumnDef {
  id: ListColumnId;
  label: string;
  /** Поле для сортировки на сервере (sort=field). Нет - колонка не сортируется. */
  sortField?: string;
  /** true - по умолчанию скрыта (доступна через настройку колонок). */
  hiddenByDefault?: boolean;
  /** Колонку нельзя скрыть/переставлять (тема - смысловой якорь строки). */
  locked?: boolean;
  /**
   * Адаптивный класс для колонок дефолтного набора - прячет их на узких
   * экранах, чтобы таблица не уезжала в горизонтальный скролл. Колонки,
   * добавленные пользователем вручную, всегда видимы (он их явно выбрал).
   */
  cellClass?: string;
}

/** Полный каталог колонок в порядке по умолчанию. */
export const LIST_COLUMNS: ListColumnDef[] = [
  { id: "id", label: "ID", sortField: "id" },
  { id: "subject", label: "Тема", sortField: "subject", locked: true },
  {
    id: "tracker",
    label: "Трекер",
    sortField: "tracker",
    cellClass: "hidden md:table-cell",
  },
  {
    id: "priority",
    label: "Приоритет",
    sortField: "priority",
    cellClass: "hidden sm:table-cell",
  },
  { id: "status", label: "Статус", sortField: "status" },
  {
    id: "updated_on",
    label: "Обновлено",
    sortField: "updated_on",
    cellClass: "hidden lg:table-cell",
  },
  { id: "project", label: "Проект", cellClass: "hidden xl:table-cell" },
  {
    id: "assigned_to",
    label: "Исполнитель",
    sortField: "assigned_to",
    cellClass: "hidden lg:table-cell",
  },
  { id: "due_date", label: "Срок", sortField: "due_date", hiddenByDefault: true },
  {
    id: "done_ratio",
    label: "Готовность",
    sortField: "done_ratio",
    hiddenByDefault: true,
  },
  { id: "category", label: "Категория", hiddenByDefault: true },
  {
    id: "fixed_version",
    label: "Версия",
    sortField: "fixed_version",
    hiddenByDefault: true,
  },
  {
    id: "start_date",
    label: "Начало",
    sortField: "start_date",
    hiddenByDefault: true,
  },
  {
    id: "estimated_hours",
    label: "Оценка",
    sortField: "estimated_hours",
    hiddenByDefault: true,
  },
  { id: "spent_hours", label: "Потрачено", hiddenByDefault: true },
];

export interface ListColumnPrefs {
  /** Порядок по id колонки. Не перечисленные идут после, в порядке каталога. */
  order: ListColumnId[];
  /** Явно скрытые колонки. */
  hidden: ListColumnId[];
}

export const EMPTY_LIST_COLUMN_PREFS: ListColumnPrefs = { order: [], hidden: [] };

const BY_ID = new Map(LIST_COLUMNS.map((c) => [c.id, c]));

/** Колонки в актуальном порядке (locked «Тема» всегда фиксирована после ID/на своём месте каталога). */
export function orderedColumns(prefs: ListColumnPrefs): ListColumnDef[] {
  const rank = new Map(prefs.order.map((id, i) => [id, i]));
  const rankOf = (id: ListColumnId) =>
    rank.has(id) ? (rank.get(id) as number) : Number.MAX_SAFE_INTEGER;
  return [...LIST_COLUMNS]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rankOf(a.c.id) - rankOf(b.c.id) || a.i - b.i)
    .map((x) => x.c);
}

export function isColumnVisible(
  prefs: ListColumnPrefs,
  col: ListColumnDef,
): boolean {
  if (col.locked) return true;
  if (prefs.hidden.includes(col.id)) return false;
  if (prefs.order.includes(col.id)) return true; // явно добавлена
  return !col.hiddenByDefault;
}

/** Список видимых колонок в порядке отображения. */
export function visibleOrderedColumns(prefs: ListColumnPrefs): ListColumnDef[] {
  return orderedColumns(prefs).filter((c) => isColumnVisible(prefs, c));
}

export function toggleColumn(
  prefs: ListColumnPrefs,
  id: ListColumnId,
): ListColumnPrefs {
  const col = BY_ID.get(id);
  if (!col || col.locked) return prefs;
  // Когда добавляем ранее скрытую по умолчанию - фиксируем её в order, чтобы
  // isColumnVisible её показал; когда прячем - в hidden.
  const wasVisible = isColumnVisible(prefs, col);
  if (wasVisible) {
    return {
      order: prefs.order,
      hidden: prefs.hidden.includes(id) ? prefs.hidden : [...prefs.hidden, id],
    };
  }
  // Включаем ранее скрытую: фиксируем ПОЛНЫЙ порядок каталога в order, чтобы
  // новая колонка встала на своё естественное место, а не прыгнула в начало
  // (order с одним id даёт этому id ранг 0).
  const fullOrder = prefs.order.length
    ? prefs.order.includes(id)
      ? prefs.order
      : [...prefs.order, id]
    : orderedColumns(prefs).map((c) => c.id);
  return {
    order: fullOrder,
    hidden: prefs.hidden.filter((x) => x !== id),
  };
}

/** Переставить колонку в общем порядке на одну позицию. */
export function moveColumn(
  prefs: ListColumnPrefs,
  id: ListColumnId,
  dir: -1 | 1,
): ListColumnPrefs {
  const ids = orderedColumns(prefs).map((c) => c.id);
  const index = ids.indexOf(id);
  const next = moveInArray(ids, index, dir);
  return { ...prefs, order: next };
}
