import { describe, expect, it } from "vitest";
import { extractPrMrLinks } from "./pr-mr-links";

describe("extractPrMrLinks", () => {
  it("находит голую ссылку на GitHub PR и извлекает host/owner/repo", () => {
    expect(
      extractPrMrLinks("см. https://github.com/acme/widget/pull/42 для деталей"),
    ).toEqual([
      {
        platform: "github",
        url: "https://github.com/acme/widget/pull/42",
        number: 42,
        host: "github.com",
        owner: "acme",
        repo: "widget",
      },
    ]);
  });

  it("находит ссылку на GitHub PR внутри markdown-синтаксиса [text](url)", () => {
    expect(
      extractPrMrLinks("[см. PR](https://github.com/acme/widget/pull/42)"),
    ).toEqual([
      {
        platform: "github",
        url: "https://github.com/acme/widget/pull/42",
        number: 42,
        host: "github.com",
        owner: "acme",
        repo: "widget",
      },
    ]);
  });

  it("находит голую ссылку на GitLab MR (gitlab.com) и извлекает host/projectPath", () => {
    expect(
      extractPrMrLinks(
        "https://gitlab.com/acme/widget/-/merge_requests/7 готов к ревью",
      ),
    ).toEqual([
      {
        platform: "gitlab",
        url: "https://gitlab.com/acme/widget/-/merge_requests/7",
        number: 7,
        host: "gitlab.com",
        projectPath: "acme/widget",
      },
    ]);
  });

  it("находит GitLab MR на self-hosted домене с вложенным namespace", () => {
    expect(
      extractPrMrLinks(
        "https://git.internal.company.com/group/subgroup/project/-/merge_requests/123",
      ),
    ).toEqual([
      {
        platform: "gitlab",
        url: "https://git.internal.company.com/group/subgroup/project/-/merge_requests/123",
        number: 123,
        host: "git.internal.company.com",
        projectPath: "group/subgroup/project",
      },
    ]);
  });

  it("находит GitHub PR на self-hosted домене (GitHub Enterprise)", () => {
    expect(
      extractPrMrLinks("https://git.internal.company.com/acme/widget/pull/9"),
    ).toEqual([
      {
        platform: "github",
        url: "https://git.internal.company.com/acme/widget/pull/9",
        number: 9,
        host: "git.internal.company.com",
        owner: "acme",
        repo: "widget",
      },
    ]);
  });

  it("не распознаёт обычную ссылку на GitHub issue", () => {
    expect(
      extractPrMrLinks("https://github.com/acme/widget/issues/5"),
    ).toEqual([]);
  });

  it("обрезает лишний хвост URL (подстраницы, query, якорь, знаки препинания)", () => {
    expect(
      extractPrMrLinks(
        "правки в https://github.com/acme/widget/pull/42/files, и ещё " +
          "https://gitlab.com/acme/widget/-/merge_requests/7?tab=diffs#note_1.",
      ),
    ).toEqual([
      {
        platform: "github",
        url: "https://github.com/acme/widget/pull/42",
        number: 42,
        host: "github.com",
        owner: "acme",
        repo: "widget",
      },
      {
        platform: "gitlab",
        url: "https://gitlab.com/acme/widget/-/merge_requests/7",
        number: 7,
        host: "gitlab.com",
        projectPath: "acme/widget",
      },
    ]);
  });

  it("дедуплицирует повторную ссылку на тот же PR/MR в пределах одного текста", () => {
    expect(
      extractPrMrLinks(
        "https://github.com/acme/widget/pull/42 и снова " +
          "https://github.com/acme/widget/pull/42/files",
      ),
    ).toEqual([
      {
        platform: "github",
        url: "https://github.com/acme/widget/pull/42",
        number: 42,
        host: "github.com",
        owner: "acme",
        repo: "widget",
      },
    ]);
  });

  it("возвращает несколько разных ссылок в порядке появления в тексте", () => {
    expect(
      extractPrMrLinks(
        "MR: https://gitlab.com/acme/widget/-/merge_requests/7, " +
          "PR: https://github.com/acme/widget/pull/42",
      ),
    ).toEqual([
      {
        platform: "gitlab",
        url: "https://gitlab.com/acme/widget/-/merge_requests/7",
        number: 7,
        host: "gitlab.com",
        projectPath: "acme/widget",
      },
      {
        platform: "github",
        url: "https://github.com/acme/widget/pull/42",
        number: 42,
        host: "github.com",
        owner: "acme",
        repo: "widget",
      },
    ]);
  });

  it("возвращает пустой список, если ссылок на PR/MR нет", () => {
    expect(extractPrMrLinks("обычный текст без ссылок")).toEqual([]);
  });
});
