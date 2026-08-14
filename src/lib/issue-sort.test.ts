import { describe, expect, it } from "vitest";
import { parseSort, toggleSort } from "@/lib/issue-sort";

describe("parseSort", () => {
  it("разбирает поле и направление", () => {
    expect(parseSort("updated_on:desc")).toEqual({
      field: "updated_on",
      dir: "desc",
    });
    expect(parseSort("id:asc")).toEqual({ field: "id", dir: "asc" });
  });
});

describe("toggleSort", () => {
  it("клик по тому же полю переключает направление desc -> asc", () => {
    expect(toggleSort("updated_on:desc", "updated_on")).toBe("updated_on:asc");
  });

  it("клик по тому же полю переключает направление asc -> desc", () => {
    expect(toggleSort("id:asc", "id")).toBe("id:desc");
  });

  it("клик по другому полю сбрасывает сортировку на desc по этому полю", () => {
    expect(toggleSort("updated_on:desc", "priority")).toBe("priority:desc");
  });
});
