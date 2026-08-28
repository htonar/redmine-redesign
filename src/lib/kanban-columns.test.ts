import { describe, expect, it } from "vitest";
import {
  moveInArray,
  sortStatusesByOrder,
  toggleHidden,
} from "@/lib/kanban-columns";

const S = [
  { id: 1, name: "New" },
  { id: 2, name: "In Progress" },
  { id: 3, name: "Feedback" },
  { id: 4, name: "Resolved" },
  { id: 5, name: "Closed" },
];

describe("sortStatusesByOrder", () => {
  it("пустой order - исходный порядок справочника", () => {
    expect(sortStatusesByOrder(S, []).map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("сортирует по order", () => {
    expect(sortStatusesByOrder(S, [5, 4, 1]).map((s) => s.id)).toEqual([
      5, 4, 1, 2, 3,
    ]);
  });

  it("статусы не из order идут в конец, сохраняя исходный относительный порядок", () => {
    expect(sortStatusesByOrder(S, [3]).map((s) => s.id)).toEqual([
      3, 1, 2, 4, 5,
    ]);
  });

  it("не мутирует вход", () => {
    const copy = [...S];
    sortStatusesByOrder(S, [2, 1]);
    expect(S).toEqual(copy);
  });
});

describe("moveInArray", () => {
  it("вниз", () => {
    expect(moveInArray([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  });
  it("вверх", () => {
    expect(moveInArray([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });
  it("за границу - без изменений (тот же массив)", () => {
    const a = [1, 2, 3];
    expect(moveInArray(a, 0, -1)).toBe(a);
    expect(moveInArray(a, 2, 1)).toBe(a);
  });
});

describe("toggleHidden", () => {
  it("добавляет и убирает", () => {
    expect(toggleHidden([], 3)).toEqual([3]);
    expect(toggleHidden([3, 5], 3)).toEqual([5]);
  });
});
