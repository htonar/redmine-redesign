import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRANCH_TEMPLATE,
  renderBranchName,
  resolveBranchType,
  sanitizeBranchName,
  slugify,
} from "@/lib/branch-name";

describe("slugify", () => {
  it("кириллица -> kebab-case ASCII", () => {
    expect(slugify("Добавить экспорт в CSV")).toBe("dobavit-eksport-v-csv");
  });

  it("схлопывает разделители и обрезает края", () => {
    expect(slugify("  --Fix:  the   bug!! --  ")).toBe("fix-the-bug");
  });

  it("ограничивает число слов", () => {
    expect(slugify("one two three four five six seven eight", { maxWords: 3 })).toBe(
      "one-two-three",
    );
  });

  it("ограничивает длину, не обрывая слово посередине", () => {
    const s = slugify("adds a really long descriptive branch slug here now", {
      maxLength: 20,
      maxWords: 20,
    });
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("-")).toBe(false);
    expect(s).toBe("adds-a-really-long");
  });

  it("пустая/безбуквенная строка -> пустой slug", () => {
    expect(slugify("!!! ???")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("resolveBranchType", () => {
  it("Bug -> fix по дефолтной карте", () => {
    expect(resolveBranchType("Bug")).toBe("fix");
    expect(resolveBranchType("баг")).toBe("fix");
  });

  it("неизвестный трекер -> feature", () => {
    expect(resolveBranchType("Feature")).toBe("feature");
    expect(resolveBranchType("Support")).toBe("feature");
    expect(resolveBranchType(undefined)).toBe("feature");
  });

  it("своя карта и свой fallback", () => {
    expect(resolveBranchType("Задача", { задача: "task" }, "chore")).toBe("task");
    expect(resolveBranchType("Прочее", { задача: "task" }, "chore")).toBe("chore");
  });
});

describe("sanitizeBranchName", () => {
  it("убирает пробелы, запрещённые символы и двойные точки", () => {
    expect(sanitizeBranchName("feature/my cool~branch..name")).toBe(
      "feature/my-coolbranch.name",
    );
  });

  it("чистит ведущие/замыкающие слэши и точки в сегментах", () => {
    expect(sanitizeBranchName("/feature/.hidden./x/")).toBe("feature/hidden/x");
  });

  it("срезает .lock на конце сегмента", () => {
    expect(sanitizeBranchName("fix/thing.lock")).toBe("fix/thing");
  });
});

describe("renderBranchName", () => {
  it("дефолтный шаблон {type}/#{id}-{slug}", () => {
    expect(
      renderBranchName(DEFAULT_BRANCH_TEMPLATE, {
        id: 42,
        slug: "add-csv-export",
        type: "feature",
      }),
    ).toBe("feature/#42-add-csv-export");
  });

  it("подставляет {tracker} и {project} в slug-форме", () => {
    expect(
      renderBranchName("{project}/{tracker}/{id}", {
        id: 7,
        slug: "x",
        type: "fix",
        tracker: "Bug Fix",
        project: "web-app",
      }),
    ).toBe("web-app/bug-fix/7");
  });

  it("пустой slug не оставляет висящий дефис", () => {
    expect(
      renderBranchName(DEFAULT_BRANCH_TEMPLATE, { id: 42, slug: "", type: "fix" }),
    ).toBe("fix/#42");
  });

  it("результат всегда чистится под git", () => {
    expect(
      renderBranchName("{type}/{slug}", {
        id: 1,
        slug: "already-clean",
        type: "feature branch",
      }),
    ).toBe("feature-branch/already-clean");
  });
});
