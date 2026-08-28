import { describe, expect, it } from "vitest";
import type { Project } from "@/hooks/useProjects";
import { orderProjectsHierarchically, projectMatchesQuery } from "@/lib/project-tree";

const p = (id: number, name: string, parentId: number | null = null): Project => ({
  id,
  name,
  parentId,
});

describe("orderProjectsHierarchically", () => {
  it("родитель, потом его дети, с нарастающей глубиной", () => {
    const out = orderProjectsHierarchically([
      p(1, "Root"),
      p(2, "Child A", 1),
      p(3, "Grandchild", 2),
      p(4, "Child B", 1),
    ]);
    expect(out.map((f) => [f.project.name, f.depth])).toEqual([
      ["Root", 0],
      ["Child A", 1],
      ["Grandchild", 2],
      ["Child B", 1],
    ]);
  });

  it("несколько корней в исходном порядке", () => {
    const out = orderProjectsHierarchically([p(10, "B"), p(20, "A")]);
    expect(out.map((f) => f.project.name)).toEqual(["B", "A"]);
  });

  it("сирота (родителя нет в списке) - корневой", () => {
    const out = orderProjectsHierarchically([p(2, "Orphan", 999)]);
    expect(out).toEqual([{ project: p(2, "Orphan", 999), depth: 0 }]);
  });

  it("каждый проект ровно один раз", () => {
    const input = [p(1, "R"), p(2, "C", 1), p(3, "D", 1)];
    const out = orderProjectsHierarchically(input);
    expect(out).toHaveLength(3);
  });
});

describe("projectMatchesQuery", () => {
  it("подстрока без регистра", () => {
    expect(projectMatchesQuery("Redfine Demo", "demo")).toBe(true);
    expect(projectMatchesQuery("Redfine Demo", "  DEMO ")).toBe(true);
    expect(projectMatchesQuery("Redfine Demo", "xyz")).toBe(false);
  });
  it("пустой запрос - всё подходит", () => {
    expect(projectMatchesQuery("что угодно", "  ")).toBe(true);
  });
});
