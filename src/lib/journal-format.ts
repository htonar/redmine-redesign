/**
 * Общее форматирование истории изменений задачи (journal.details) - используется
 * и в карточке задачи (IssueDetailPage), и в ленте активности на дашборде
 * (ActivityFeed), см. CLAUDE.md.
 */

/** Человекочитаемые подписи для самых частых полей в истории изменений (journal.details). */
export const FIELD_LABELS: Record<string, string> = {
  status_id: "Статус",
  assigned_to_id: "Исполнитель",
  priority_id: "Приоритет",
  subject: "Тема",
  description: "Описание",
  done_ratio: "Готовность",
  fixed_version_id: "Версия",
  category_id: "Категория",
  start_date: "Дата начала",
  due_date: "Срок",
  estimated_hours: "Оценка часов",
  tracker_id: "Трекер",
  project_id: "Проект",
  is_private: "Приватность",
  parent_id: "Родительская задача",
  child_id: "Подзадача",
};

/**
 * Карты id -> имя для полей journal.details, где Redmine REST API отдает
 * сырой числовой id вместо названия (status_id/priority_id/tracker_id/
 * fixed_version_id/category_id/assigned_to_id/project_id). Опциональные -
 * строятся из уже загруженных на странице справочников (useIssueStatuses,
 * useTrackers, useIssuePriorities, useProjectCategories, useProjectVersions,
 * useProjectMembers); поле без карты (например parent_id/child_id - ссылка
 * на другую задачу) остается как есть - тянуть тему связанной задачи ради
 * истории не оправдано (N+1).
 */
export type JournalValueMaps = Partial<
  Record<
    | "status_id"
    | "priority_id"
    | "tracker_id"
    | "fixed_version_id"
    | "category_id"
    | "assigned_to_id"
    | "project_id",
    Record<number, string>
  >
>;

/**
 * Резолвит одно значение (old_value/new_value) из journal.details в
 * человекочитаемое имя, если для этого поля есть карта id -> имя и id в ней
 * найден. Иначе - возвращает значение как есть (в т.ч. "—" для null),
 * это fallback, не баг.
 */
export function resolveJournalFieldValue(
  name: string,
  value: string | null,
  maps: JournalValueMaps,
): string {
  if (value === null) return "—";
  const map = maps[name as keyof JournalValueMaps];
  if (!map) return value;
  return map[Number(value)] ?? value;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
