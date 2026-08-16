import { toCsv } from "@/lib/csv";
import type { TimeEntry } from "@/api/timeEntries";

/**
 * CSV-представление списка записей времени (issue #21) - плоская таблица,
 * одна строка на запись, порядок как передан (страница уже сортирует через
 * listTimeEntries: sort=spent_on:desc). Пользователь - отдельной колонкой,
 * важно при scope=all (иначе колонка молча дублирует "мои записи").
 */
export function timeEntriesToCsv(entries: TimeEntry[]): string {
  return toCsv(
    ["Дата", "Проект", "Задача", "Вид деятельности", "Пользователь", "Часы", "Комментарий"],
    entries.map((e) => [
      e.spent_on,
      e.project?.name ?? "",
      e.issue ? `#${e.issue.id}` : "",
      e.activity?.name ?? "",
      e.user?.name ?? "",
      e.hours,
      e.comments ?? "",
    ]),
  );
}
