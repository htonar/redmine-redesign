import { describe, expect, it } from "vitest";
import { timeEntriesToCsv } from "@/lib/time-entries-csv";
import type { TimeEntry } from "@/api/timeEntries";

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: overrides.id ?? 1,
    project: { id: 1, name: "Проект X" },
    issue: { id: 42 },
    user: { id: 1, name: "Егор" },
    activity: { id: 1, name: "Разработка" },
    hours: 1.5,
    comments: "Сделал кусок",
    spent_on: "2026-08-10",
    created_on: "2026-08-10T10:00:00Z",
    updated_on: "2026-08-10T10:00:00Z",
    ...overrides,
  } as TimeEntry;
}

const HEADER = "Дата,Проект,Задача,Вид деятельности,Пользователь,Часы,Комментарий";

describe("timeEntriesToCsv", () => {
  it("пустой список -> только заголовок", () => {
    expect(timeEntriesToCsv([])).toBe(HEADER);
  });

  it("запись с задачей", () => {
    const csv = timeEntriesToCsv([entry()]);
    expect(csv).toBe(
      `${HEADER}\r\n2026-08-10,Проект X,#42,Разработка,Егор,1.5,Сделал кусок`,
    );
  });

  it("запись без задачи (только проект)", () => {
    const csv = timeEntriesToCsv([entry({ issue: undefined })]);
    expect(csv).toBe(`${HEADER}\r\n2026-08-10,Проект X,,Разработка,Егор,1.5,Сделал кусок`);
  });

  it("пустой комментарий (null) -> пустая ячейка", () => {
    const csv = timeEntriesToCsv([entry({ comments: null })]);
    expect(csv).toBe(`${HEADER}\r\n2026-08-10,Проект X,#42,Разработка,Егор,1.5,`);
  });

  it("экранирует запятую в комментарии", () => {
    const csv = timeEntriesToCsv([entry({ comments: "часть 1, часть 2" })]);
    expect(csv).toContain('"часть 1, часть 2"');
  });
});
