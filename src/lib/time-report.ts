import type { TimeEntry } from "@/api/timeEntries";

/**
 * Агрегация записей времени для отчёта по трудозатратам (issue #57): сумма
 * часов за период и разбивки по задачам / исполнителям / видам деятельности.
 * Чистые функции - оркестрация в useTimeReport, UI в ReportsPage.
 */

export interface TimeReportRow {
  /** id сущности (issue id / user id / activity id) - для подстановки темы задачи. */
  key: string;
  label: string;
  hours: number;
  /** Доля от общей суммы, 0..1. */
  share: number;
}

export interface TimeReport {
  totalHours: number;
  entryCount: number;
  byIssue: TimeReportRow[];
  byUser: TimeReportRow[];
  byActivity: TimeReportRow[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function group(
  entries: TimeEntry[],
  keyOf: (e: TimeEntry) => string,
  labelOf: (e: TimeEntry) => string,
  total: number,
): TimeReportRow[] {
  const acc = new Map<string, { label: string; hours: number }>();
  for (const e of entries) {
    const key = keyOf(e);
    const cur = acc.get(key);
    if (cur) cur.hours += e.hours;
    else acc.set(key, { label: labelOf(e), hours: e.hours });
  }
  return [...acc.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      hours: round2(v.hours),
      share: total > 0 ? v.hours / total : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

export function buildTimeReport(entries: TimeEntry[]): TimeReport {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return {
    totalHours: round2(totalHours),
    entryCount: entries.length,
    byIssue: group(
      entries,
      (e) => (e.issue ? `issue-${e.issue.id}` : "no-issue"),
      (e) => (e.issue ? `#${e.issue.id}` : "Без задачи"),
      totalHours,
    ),
    byUser: group(
      entries,
      (e) => (e.user ? `user-${e.user.id}` : "no-user"),
      (e) => e.user?.name ?? "Неизвестно",
      totalHours,
    ),
    byActivity: group(
      entries,
      (e) => (e.activity ? `act-${e.activity.id}` : "no-act"),
      (e) => e.activity?.name ?? "Без вида деятельности",
      totalHours,
    ),
  };
}

/** id задач из byIssue - чтобы подтянуть темы через useIssueSummaries. */
export function issueIdsFromReport(report: TimeReport): number[] {
  return report.byIssue
    .map((r) => (r.key.startsWith("issue-") ? Number(r.key.slice(6)) : null))
    .filter((id): id is number => id != null);
}
