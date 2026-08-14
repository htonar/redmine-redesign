import { describe, expect, it, vi } from "vitest";
import { listIssues, type IssueListParams, type IssueSummary } from "@/api/issues";
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
});
