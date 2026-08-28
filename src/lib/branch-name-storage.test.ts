import { afterEach, describe, expect, it } from "vitest";
import {
  formatTypeMap,
  loadBranchNameConfig,
  parseTypeMap,
  resetBranchNameConfig,
  saveBranchNameConfig,
} from "@/lib/branch-name-storage";
import { DEFAULT_BRANCH_TEMPLATE } from "@/lib/branch-name";

afterEach(() => {
  localStorage.clear();
});

describe("parseTypeMap", () => {
  it("парсит строки трекер=префикс, приводя ключ к нижнему регистру", () => {
    expect(parseTypeMap("Bug=fix\n Баг = fix \nFeature=feature")).toEqual({
      bug: "fix",
      баг: "fix",
      feature: "feature",
    });
  });

  it("игнорирует пустые и кривые строки", () => {
    expect(parseTypeMap("\n=fix\nbugfix\n  \nbug=fix")).toEqual({ bug: "fix" });
  });
});

describe("formatTypeMap", () => {
  it("обратна parseTypeMap по содержимому", () => {
    const map = { bug: "fix", chore: "chore" };
    expect(parseTypeMap(formatTypeMap(map))).toEqual(map);
  });
});

describe("loadBranchNameConfig", () => {
  it("возвращает дефолты, если ничего не сохранено", () => {
    const cfg = loadBranchNameConfig();
    expect(cfg.template).toBe(DEFAULT_BRANCH_TEMPLATE);
    expect(cfg.useAi).toBe(false);
    expect(cfg.typeMap.bug).toBe("fix");
  });

  it("читает сохранённое и переживает round-trip", () => {
    saveBranchNameConfig({
      template: "{type}/{id}",
      typeMap: { задача: "task" },
      useAi: true,
    });
    const cfg = loadBranchNameConfig();
    expect(cfg).toEqual({
      template: "{type}/{id}",
      typeMap: { задача: "task" },
      useAi: true,
    });
  });

  it("подставляет дефолтный шаблон, если сохранён пустой", () => {
    localStorage.setItem(
      "redmine-client:branch-name-config",
      JSON.stringify({ template: "   ", useAi: false }),
    );
    expect(loadBranchNameConfig().template).toBe(DEFAULT_BRANCH_TEMPLATE);
  });

  it("не падает на мусоре в сторадже", () => {
    localStorage.setItem("redmine-client:branch-name-config", "{ broken");
    expect(loadBranchNameConfig().template).toBe(DEFAULT_BRANCH_TEMPLATE);
  });

  it("reset убирает сохранённое", () => {
    saveBranchNameConfig({ template: "x", typeMap: {}, useAi: true });
    resetBranchNameConfig();
    expect(loadBranchNameConfig().useAi).toBe(false);
  });
});
