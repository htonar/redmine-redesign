import { describe, expect, it } from "vitest";
import { buildIssueReport } from "@/lib/issue-report";
import type { IssueSummary } from "@/api/issues";

function issue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 100000),
    subject: "Тестовая задача",
    description: null,
    start_date: null,
    due_date: null,
    done_ratio: 0,
    is_private: false,
    estimated_hours: null,
    total_estimated_hours: null,
    created_on: "2026-01-01T00:00:00Z",
    updated_on: "2026-01-01T00:00:00Z",
    tracker: { id: 1, name: "Задача" },
    status: { id: 1, name: "Новая", is_closed: false },
    fixed_version: undefined,
    ...overrides,
  } as IssueSummary;
}

describe("buildIssueReport", () => {
  it("пустой список -> нули и пустые бакеты", () => {
    const report = buildIssueReport([]);
    expect(report.total).toBe(0);
    expect(report.openCount).toBe(0);
    expect(report.closedCount).toBe(0);
    expect(report.byTracker).toEqual([]);
    expect(report.byStatus).toEqual([]);
    expect(report.byVersion).toEqual([]);
  });

  it("группирует по трекеру", () => {
    const report = buildIssueReport([
      issue({ tracker: { id: 1, name: "Баг" } }),
      issue({ tracker: { id: 1, name: "Баг" } }),
      issue({ tracker: { id: 2, name: "Фича" } }),
    ]);
    expect(report.byTracker).toEqual([
      { label: "Баг", count: 2 },
      { label: "Фича", count: 1 },
    ]);
  });

  it("группирует по статусу и учитывает is_closed", () => {
    const report = buildIssueReport([
      issue({ status: { id: 1, name: "Новая", is_closed: false } }),
      issue({ status: { id: 1, name: "Новая", is_closed: false } }),
      issue({ status: { id: 2, name: "Закрыта", is_closed: true } }),
    ]);
    expect(report.byStatus).toEqual([
      { label: "Новая", count: 2, isClosed: false },
      { label: "Закрыта", count: 1, isClosed: true },
    ]);
    expect(report.openCount).toBe(2);
    expect(report.closedCount).toBe(1);
  });

  it("issue без fixed_version попадает в 'Без версии'", () => {
    const report = buildIssueReport([
      issue({ fixed_version: undefined }),
      issue({ fixed_version: { id: 1, name: "1.0" } }),
    ]);
    expect(report.byVersion).toEqual(
      expect.arrayContaining([
        { label: "Без версии", count: 1 },
        { label: "1.0", count: 1 },
      ]),
    );
  });

  it("сортирует бакеты по count по убыванию", () => {
    const report = buildIssueReport([
      issue({ tracker: { id: 1, name: "Редкий" } }),
      issue({ tracker: { id: 2, name: "Частый" } }),
      issue({ tracker: { id: 2, name: "Частый" } }),
      issue({ tracker: { id: 2, name: "Частый" } }),
    ]);
    expect(report.byTracker.map((b) => b.label)).toEqual(["Частый", "Редкий"]);
  });

  it("сворачивает категории после топ-7 в 'Другое'", () => {
    const issues: IssueSummary[] = [];
    for (let i = 0; i < 10; i++) {
      // Каждой версии - убывающее число задач (10-i), чтобы порядок был предсказуем.
      for (let j = 0; j < 10 - i; j++) {
        issues.push(issue({ fixed_version: { id: i, name: `v${i}` } }));
      }
    }
    const report = buildIssueReport(issues);
    expect(report.byVersion).toHaveLength(8);
    expect(report.byVersion.slice(0, 7).map((b) => b.label)).toEqual([
      "v0",
      "v1",
      "v2",
      "v3",
      "v4",
      "v5",
      "v6",
    ]);
    const other = report.byVersion[7];
    expect(other.label).toBe("Другое");
    // v7 (3 задачи) + v8 (2) + v9 (1) = 6
    expect(other.count).toBe(6);
  });

  it("total = сумма всех задач", () => {
    const report = buildIssueReport([issue(), issue(), issue()]);
    expect(report.total).toBe(3);
  });
});
