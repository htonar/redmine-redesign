import type { IssueSummary } from "@/api/issues";

/** Максимум различимых категорий на одну ось разбивки - остальное сворачивается в "Другое". */
const MAX_BUCKETS = 8;

export interface ReportBucket {
  label: string;
  count: number;
  /** Только для byStatus - открыт/закрыт этот конкретный статус. */
  isClosed?: boolean;
}

export interface IssueReport {
  total: number;
  openCount: number;
  closedCount: number;
  byTracker: ReportBucket[];
  byStatus: ReportBucket[];
  byVersion: ReportBucket[];
}

/** Сортировка по count убыв.; после MAX_BUCKETS - схлопывание хвоста в "Другое". */
function capBuckets(buckets: ReportBucket[]): ReportBucket[] {
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  if (sorted.length <= MAX_BUCKETS) return sorted;

  const head = sorted.slice(0, MAX_BUCKETS - 1);
  const tail = sorted.slice(MAX_BUCKETS - 1);
  const otherCount = tail.reduce((sum, b) => sum + b.count, 0);
  return [...head, { label: "Другое", count: otherCount }];
}

function groupByLabel(
  issues: IssueSummary[],
  getLabel: (issue: IssueSummary) => string,
  getIsClosed?: (issue: IssueSummary) => boolean | undefined,
): ReportBucket[] {
  const counts = new Map<string, ReportBucket>();
  for (const issue of issues) {
    const label = getLabel(issue);
    const existing = counts.get(label);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(label, {
        label,
        count: 1,
        ...(getIsClosed ? { isClosed: getIsClosed(issue) } : {}),
      });
    }
  }
  return capBuckets([...counts.values()]);
}

/**
 * Сводка по задачам проекта - группировка на фронте поверх уже загруженного
 * списка (нет отдельного summary-эндпоинта в Redmine REST API, см. GitHub
 * issue #13). Источник данных - listAllIssues (src/api/issues.ts).
 */
export function buildIssueReport(issues: IssueSummary[]): IssueReport {
  const openCount = issues.filter((i) => !i.status?.is_closed).length;
  const closedCount = issues.length - openCount;

  return {
    total: issues.length,
    openCount,
    closedCount,
    byTracker: groupByLabel(issues, (i) => i.tracker?.name ?? "Без трекера"),
    byStatus: groupByLabel(
      issues,
      (i) => i.status?.name ?? "Без статуса",
      (i) => i.status?.is_closed,
    ),
    byVersion: groupByLabel(issues, (i) => i.fixed_version?.name ?? "Без версии"),
  };
}
