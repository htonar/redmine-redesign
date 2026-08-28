import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@/api/timeEntries";
import { buildTimeReport, issueIdsFromReport } from "@/lib/time-report";

const te = (partial: Partial<TimeEntry>): TimeEntry =>
  ({
    id: Math.random(),
    hours: 1,
    comments: null,
    spent_on: "2026-08-28",
    created_on: "",
    updated_on: "",
    ...partial,
  }) as TimeEntry;

describe("buildTimeReport", () => {
  const entries = [
    te({ hours: 2, issue: { id: 10 }, user: { id: 1, name: "Аня" }, activity: { id: 9, name: "Development" } }),
    te({ hours: 3, issue: { id: 10 }, user: { id: 2, name: "Боря" }, activity: { id: 9, name: "Development" } }),
    te({ hours: 1, issue: { id: 20 }, user: { id: 1, name: "Аня" }, activity: { id: 8, name: "Design" } }),
  ];

  it("суммарные часы и число записей", () => {
    const r = buildTimeReport(entries);
    expect(r.totalHours).toBe(6);
    expect(r.entryCount).toBe(3);
  });

  it("по задачам - сортировка по часам убыв., доли", () => {
    const r = buildTimeReport(entries);
    expect(r.byIssue.map((x) => [x.label, x.hours])).toEqual([
      ["#10", 5],
      ["#20", 1],
    ]);
    expect(r.byIssue[0].share).toBeCloseTo(5 / 6);
  });

  it("по исполнителям", () => {
    const r = buildTimeReport(entries);
    expect(r.byUser.map((x) => [x.label, x.hours])).toEqual([
      ["Аня", 3],
      ["Боря", 3],
    ]);
  });

  it("по видам деятельности", () => {
    const r = buildTimeReport(entries);
    expect(r.byActivity.map((x) => [x.label, x.hours])).toEqual([
      ["Development", 5],
      ["Design", 1],
    ]);
  });

  it("запись без задачи попадает в «Без задачи»", () => {
    const r = buildTimeReport([te({ hours: 4 })]);
    expect(r.byIssue).toEqual([
      { key: "no-issue", label: "Без задачи", hours: 4, share: 1 },
    ]);
  });

  it("issueIdsFromReport достаёт только реальные id", () => {
    const r = buildTimeReport(entries);
    expect(issueIdsFromReport(r).sort()).toEqual([10, 20]);
  });

  it("пустой ввод - нули без деления на ноль", () => {
    const r = buildTimeReport([]);
    expect(r.totalHours).toBe(0);
    expect(r.byIssue).toEqual([]);
  });
});
