import type { SearchTypeFilter } from "@/api/search";

/**
 * Машинные значения `type` в ответе /search.json (взяты из практики самого
 * Redmine - явной таблицы в REST-вики нет). Незнакомый тип показываем как
 * есть, не выдумывая перевод.
 */
export const SEARCH_TYPE_LABELS: Record<string, string> = {
  issue: "Задача",
  // Redmine отдаёт отдельный тип для закрытых задач.
  "issue-closed": "Задача (закрыта)",
  project: "Проект",
  news: "Новость",
  document: "Документ",
  changeset: "Коммит",
  "wiki-page": "Wiki",
  message: "Форум",
};

export function searchTypeLabel(type: string): string {
  return SEARCH_TYPE_LABELS[type] ?? type;
}

/**
 * Фильтры для страницы поиска: `key` - флаг запроса /search.json,
 * `resultType` - соответствующее значение `type` в результатах (для UI).
 * Коммиты/репозитории намеренно не в списке (вне фокуса продукта).
 */
export const SEARCH_TYPE_FILTERS: {
  key: SearchTypeFilter;
  label: string;
}[] = [
  { key: "all", label: "Все" },
  { key: "issues", label: "Задачи" },
  { key: "projects", label: "Проекты" },
  { key: "wiki_pages", label: "Wiki" },
  { key: "news", label: "Новости" },
  { key: "documents", label: "Документы" },
  { key: "messages", label: "Форум" },
];
