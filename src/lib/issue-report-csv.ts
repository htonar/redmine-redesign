import { toCsv } from "@/lib/csv";
import type { IssueReport } from "@/lib/issue-report";

/**
 * CSV-представление уже посчитанного IssueReport (issue #21) - без похода
 * за задачами, поверх того, что и так показывает ReportsPage: показатели +
 * три секции разбивки (трекер/статус/версия), в том же порядке, что на
 * экране. Секции разделены пустой строкой.
 */
export function issueReportToCsv(report: IssueReport): string {
  const summary = toCsv(
    ["Показатель", "Значение"],
    [
      ["Всего задач", report.total],
      ["Открыто", report.openCount],
      ["Закрыто", report.closedCount],
    ],
  );
  const byTracker = toCsv(
    ["По трекеру", "Количество"],
    report.byTracker.map((b) => [b.label, b.count]),
  );
  const byStatus = toCsv(
    ["По статусу", "Количество"],
    report.byStatus.map((b) => [b.label, b.count]),
  );
  const byVersion = toCsv(
    ["По версии", "Количество"],
    report.byVersion.map((b) => [b.label, b.count]),
  );

  return [summary, byTracker, byStatus, byVersion].join("\r\n\r\n");
}
