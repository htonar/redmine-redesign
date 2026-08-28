import { toCsv } from "@/lib/csv";
import type { TimeReport, TimeReportRow } from "@/lib/time-report";

/**
 * CSV уже посчитанного TimeReport (issue #57) - показатели + три разбивки
 * (по задачам / исполнителям / видам деятельности), в том же порядке, что на
 * экране. `issueLabel` - опциональный резолвер темы задачи по строке
 * byIssue (иначе в CSV попадёт голый "#123").
 */
export function timeReportToCsv(
  report: TimeReport,
  issueLabel?: (row: TimeReportRow) => string,
): string {
  const summary = toCsv(
    ["Показатель", "Значение"],
    [
      ["Всего часов", report.totalHours],
      ["Записей", report.entryCount],
    ],
  );
  const byIssue = toCsv(
    ["По задачам", "Часы", "Доля %"],
    report.byIssue.map((r) => [
      issueLabel ? issueLabel(r) : r.label,
      r.hours,
      Math.round(r.share * 100),
    ]),
  );
  const byUser = toCsv(
    ["По исполнителям", "Часы", "Доля %"],
    report.byUser.map((r) => [r.label, r.hours, Math.round(r.share * 100)]),
  );
  const byActivity = toCsv(
    ["По видам деятельности", "Часы", "Доля %"],
    report.byActivity.map((r) => [r.label, r.hours, Math.round(r.share * 100)]),
  );

  return [summary, byIssue, byUser, byActivity].join("\r\n\r\n");
}
