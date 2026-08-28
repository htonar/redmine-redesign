import { describe, expect, it } from "vitest";
import {
  EMPTY_LIST_COLUMN_PREFS,
  isColumnVisible,
  LIST_COLUMNS,
  moveColumn,
  orderedColumns,
  toggleColumn,
  visibleOrderedColumns,
  type ListColumnDef,
} from "@/lib/list-columns";

const col = (id: string) =>
  LIST_COLUMNS.find((c) => c.id === id) as ListColumnDef;

describe("list-columns", () => {
  it("по умолчанию видны не-hiddenByDefault колонки", () => {
    const visible = visibleOrderedColumns(EMPTY_LIST_COLUMN_PREFS).map(
      (c) => c.id,
    );
    expect(visible).toContain("status");
    expect(visible).toContain("assigned_to");
    expect(visible).not.toContain("due_date");
  });

  it("toggleColumn прячет видимую и показывает скрытую", () => {
    let p = toggleColumn(EMPTY_LIST_COLUMN_PREFS, "status");
    expect(isColumnVisible(p, col("status"))).toBe(false);
    p = toggleColumn(p, "status");
    expect(isColumnVisible(p, col("status"))).toBe(true);
  });

  it("toggleColumn включает скрытую по умолчанию - на своём месте каталога", () => {
    const p = toggleColumn(EMPTY_LIST_COLUMN_PREFS, "due_date");
    expect(isColumnVisible(p, col("due_date"))).toBe(true);
    const visible = visibleOrderedColumns(p).map((c) => c.id);
    expect(visible).toContain("due_date");
    // не прыгнула в начало - после assigned_to, как в каталоге
    expect(visible.indexOf("due_date")).toBeGreaterThan(
      visible.indexOf("assigned_to"),
    );
  });

  it("locked колонку (Тема) нельзя скрыть", () => {
    const p = toggleColumn(EMPTY_LIST_COLUMN_PREFS, "subject");
    expect(isColumnVisible(p, col("subject"))).toBe(true);
  });

  it("moveColumn переставляет колонку", () => {
    const before = orderedColumns(EMPTY_LIST_COLUMN_PREFS).map((c) => c.id);
    const iTracker = before.indexOf("tracker");
    const p = moveColumn(EMPTY_LIST_COLUMN_PREFS, "tracker", -1);
    const after = orderedColumns(p).map((c) => c.id);
    expect(after.indexOf("tracker")).toBe(iTracker - 1);
  });

  it("moveColumn за границу - без изменений", () => {
    const first = orderedColumns(EMPTY_LIST_COLUMN_PREFS)[0].id;
    const p = moveColumn(EMPTY_LIST_COLUMN_PREFS, first, -1);
    expect(orderedColumns(p).map((c) => c.id)).toEqual(
      orderedColumns(EMPTY_LIST_COLUMN_PREFS).map((c) => c.id),
    );
  });
});
