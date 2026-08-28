import { describe, expect, it, vi } from "vitest";
import {
  listAllIssues,
  listIssues,
  type IssueListFilters,
  type IssueListParams,
  type IssueSummary,
} from "@/api/issues";
import type { RedmineClient } from "@/api/client";

function mockClient(GET: ReturnType<typeof vi.fn>): RedmineClient {
  return { GET } as unknown as RedmineClient;
}

const baseParams: IssueListParams = {
  assignee: "me",
  status: "open",
  sort: "updated_on:desc",
  offset: 0,
  limit: 25,
};

const baseFilters: IssueListFilters = {
  projectId: 1,
  assignee: "all",
  status: "all",
  sort: "id",
};

describe("listIssues", () => {
  it("assignee 'me' -> assigned_to_id: 'me'", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, assignee: "me" });
    expect(GET).toHaveBeenCalledWith(
      "/issues.{format}",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ assigned_to_id: "me" }),
        }),
      }),
    );
  });

  it("assignee 'all' -> assigned_to_id: undefined", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, assignee: "all" });
    expect(GET.mock.calls[0][1].params.query.assigned_to_id).toBeUndefined();
  });

  it.each([
    ["open", "o"],
    ["closed", "c"],
    ["all", "*"],
  ] as const)("status '%s' -> status_id: '%s'", async (status, statusId) => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, status });
    expect(GET.mock.calls[0][1].params.query.status_id).toBe(statusId);
  });

  it("projectId задан -> строкой, не задан -> undefined", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, projectId: 42 });
    expect(GET.mock.calls[0][1].params.query.project_id).toBe("42");

    const GET2 = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET2), { ...baseParams, projectId: undefined });
    expect(GET2.mock.calls[0][1].params.query.project_id).toBeUndefined();
  });

  it("sort/offset/limit передаются как есть", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), {
      ...baseParams,
      sort: "priority:desc,updated_on:desc",
      offset: 50,
      limit: 100,
    });
    const query = GET.mock.calls[0][1].params.query;
    expect(query.sort).toBe("priority:desc,updated_on:desc");
    expect(query.offset).toBe(50);
    expect(query.limit).toBe(100);
  });

  it("totalCount берётся из total_count, если есть", async () => {
    const issues: IssueSummary[] = [{ id: 1 } as IssueSummary];
    const GET = vi
      .fn()
      .mockResolvedValue({ data: { issues, total_count: 123 } });
    const result = await listIssues(mockClient(GET), baseParams);
    expect(result.totalCount).toBe(123);
    expect(result.issues).toBe(issues);
  });

  it("totalCount - fallback на issues.length, если total_count отсутствует", async () => {
    const issues: IssueSummary[] = [
      { id: 1 } as IssueSummary,
      { id: 2 } as IssueSummary,
    ];
    const GET = vi.fn().mockResolvedValue({ data: { issues } });
    const result = await listIssues(mockClient(GET), baseParams);
    expect(result.totalCount).toBe(2);
  });

  it("бросает ошибку, если API вернул error/пустые данные", async () => {
    const GET = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    await expect(listIssues(mockClient(GET), baseParams)).rejects.toThrow(
      "Не удалось загрузить список задач.",
    );
  });

  it("queryId задан -> query_id передается, остальные фильтры не отправляются (Redmine их игнорирует)", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), {
      ...baseParams,
      queryId: 7,
      projectId: 42,
      assignee: "me",
      status: "closed",
    });
    const query = GET.mock.calls[0][1].params.query;
    expect(query.query_id).toBe(7);
    expect(query.project_id).toBeUndefined();
    expect(query.assigned_to_id).toBeUndefined();
    expect(query.status_id).toBeUndefined();
  });

  it("queryId не задан -> query_id: undefined", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), baseParams);
    expect(GET.mock.calls[0][1].params.query.query_id).toBeUndefined();
  });

  it("watcher 'me' -> watcher_id: 'me', не задан -> undefined", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, watcher: "me" });
    expect(GET.mock.calls[0][1].params.query.watcher_id).toBe("me");

    const GET2 = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET2), baseParams);
    expect(GET2.mock.calls[0][1].params.query.watcher_id).toBeUndefined();
  });

  it("расширенные фильтры (трекер/приоритет/версия/автор) -> *_id строкой", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), {
      ...baseParams,
      trackerId: 2,
      priorityId: 5,
      versionId: 9,
      authorId: 11,
    });
    const query = GET.mock.calls[0][1].params.query;
    expect(query.tracker_id).toBe("2");
    expect(query.priority_id).toBe("5");
    expect(query.fixed_version_id).toBe("9");
    expect(query.author_id).toBe("11");
  });

  it("расширенные фильтры не заданы -> соответствующие параметры undefined", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), baseParams);
    const query = GET.mock.calls[0][1].params.query;
    expect(query.tracker_id).toBeUndefined();
    expect(query.priority_id).toBeUndefined();
    expect(query.fixed_version_id).toBeUndefined();
    expect(query.author_id).toBeUndefined();
    expect(query.subject).toBeUndefined();
  });

  it("subject -> оператор '~' (содержит), пустая строка игнорируется", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), { ...baseParams, subject: "  логин  " });
    expect(GET.mock.calls[0][1].params.query.subject).toBe("~логин");

    const GET2 = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET2), { ...baseParams, subject: "   " });
    expect(GET2.mock.calls[0][1].params.query.subject).toBeUndefined();
  });

  it("queryId задан -> расширенные фильтры тоже не отправляются", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { issues: [] } });
    await listIssues(mockClient(GET), {
      ...baseParams,
      queryId: 3,
      trackerId: 2,
      subject: "x",
    });
    const query = GET.mock.calls[0][1].params.query;
    expect(query.tracker_id).toBeUndefined();
    expect(query.subject).toBeUndefined();
  });
});

function fakeIssues(count: number): IssueSummary[] {
  return Array.from({ length: count }, (_, i) => ({ id: i })) as IssueSummary[];
}

describe("listAllIssues", () => {
  it("totalCount помещается на одну страницу -> один запрос", async () => {
    const GET = vi.fn().mockResolvedValue({
      data: { issues: fakeIssues(2), total_count: 2 },
    });
    const result = await listAllIssues(mockClient(GET), baseFilters);
    expect(GET).toHaveBeenCalledTimes(1);
    expect(result.issues).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.isCapped).toBe(false);
  });

  it("несколько страниц -> конкатенирует issues по всем вызовам", async () => {
    const GET = vi
      .fn()
      .mockResolvedValueOnce({ data: { issues: fakeIssues(100), total_count: 150 } })
      .mockResolvedValueOnce({ data: { issues: fakeIssues(50), total_count: 150 } });
    const result = await listAllIssues(mockClient(GET), baseFilters);
    expect(GET).toHaveBeenCalledTimes(2);
    expect(result.issues).toHaveLength(150);
    expect(result.totalCount).toBe(150);
    expect(result.isCapped).toBe(false);
    expect(GET.mock.calls[1][1].params.query.offset).toBe(100);
  });

  it("аномально большой totalCount -> останавливается на защитном лимите, isCapped: true", async () => {
    const GET = vi.fn().mockResolvedValue({
      data: { issues: fakeIssues(100), total_count: 5000 },
    });
    const result = await listAllIssues(mockClient(GET), baseFilters);
    expect(result.issues.length).toBeLessThanOrEqual(1000);
    expect(result.isCapped).toBe(true);
    // Цикл действительно остановился, а не завис - конечное число запросов.
    expect(GET.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("сервер вернул пустую страницу раньше totalCount -> цикл обрывается, а не зависает", async () => {
    const GET = vi.fn().mockResolvedValue({
      data: { issues: [], total_count: 50 },
    });
    const result = await listAllIssues(mockClient(GET), baseFilters);
    expect(GET).toHaveBeenCalledTimes(1);
    expect(result.issues).toHaveLength(0);
  });
});
