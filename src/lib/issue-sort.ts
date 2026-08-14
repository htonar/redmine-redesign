/**
 * Разбор/переключение строки сортировки в формате Redmine (`field:desc`,
 * см. IssueListFilters["sort"]) - вынесено из IssuesPage.tsx, чтобы покрыть
 * тестом без рендера страницы.
 */
export interface ParsedSort {
  field: string;
  dir: "asc" | "desc";
}

export function parseSort(sort: string): ParsedSort {
  const [field, dir] = sort.split(":") as [string, "asc" | "desc"];
  return { field, dir };
}

/** Клик по заголовку колонки: то же поле - меняем направление, другое - сброс на desc. */
export function toggleSort(current: string, field: string): string {
  const { field: currentField, dir: currentDir } = parseSort(current);
  if (field === currentField) {
    return `${field}:${currentDir === "desc" ? "asc" : "desc"}`;
  }
  return `${field}:desc`;
}
