import { describe, expect, it } from "vitest";
import { buildBranchSlugMessages } from "@/lib/branch-slug-prompt";

describe("buildBranchSlugMessages", () => {
  it("system-сообщение требует kebab-case ASCII без префиксов", () => {
    const [system] = buildBranchSlugMessages("Добавить экспорт");
    expect(system.role).toBe("system");
    expect(system.content).toMatch(/\[a-z0-9-\]/);
    expect(system.content.toLowerCase()).toContain("no prefixes");
  });

  it("user-сообщение - тема задачи как есть", () => {
    const [, user] = buildBranchSlugMessages("  Добавить экспорт в CSV  ");
    expect(user).toEqual({ role: "user", content: "Добавить экспорт в CSV" });
  });

  it("пустая тема заменяется на 'task'", () => {
    const [, user] = buildBranchSlugMessages("   ");
    expect(user.content).toBe("task");
  });
});
