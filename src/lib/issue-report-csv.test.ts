import { describe, expect, it } from "vitest";
import { issueReportToCsv } from "@/lib/issue-report-csv";
import type { IssueReport } from "@/lib/issue-report";

function report(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    total: 0,
    openCount: 0,
    closedCount: 0,
    byTracker: [],
    byStatus: [],
    byVersion: [],
    ...overrides,
  };
}

describe("issueReportToCsv", () => {
  it("пустой отчет -> только секция показателей с нулями", () => {
    const csv = issueReportToCsv(report());
    expect(csv).toBe(
      [
        "Показатель,Значение",
        "Всего задач,0",
        "Открыто,0",
        "Закрыто,0",
        "",
        "По трекеру,Количество",
        "",
        "По статусу,Количество",
        "",
        "По версии,Количество",
      ].join("\r\n"),
    );
  });

  it("непустые бакеты -> все три секции в исходном порядке", () => {
    const csv = issueReportToCsv(
      report({
        total: 3,
        openCount: 2,
        closedCount: 1,
        byTracker: [
          { label: "Баг", count: 2 },
          { label: "Фича", count: 1 },
        ],
        byStatus: [{ label: "Новая", count: 2, isClosed: false }],
        byVersion: [{ label: "1.0", count: 3 }],
      }),
    );
    expect(csv).toBe(
      [
        "Показатель,Значение",
        "Всего задач,3",
        "Открыто,2",
        "Закрыто,1",
        "",
        "По трекеру,Количество",
        "Баг,2",
        "Фича,1",
        "",
        "По статусу,Количество",
        "Новая,2",
        "",
        "По версии,Количество",
        "1.0,3",
      ].join("\r\n"),
    );
  });

  it("экранирует метки бакетов с запятой", () => {
    const csv = issueReportToCsv(
      report({ byTracker: [{ label: "Баг, критичный", count: 1 }] }),
    );
    expect(csv).toContain('"Баг, критичный",1');
  });
});
