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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
