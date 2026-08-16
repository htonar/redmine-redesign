import { describe, expect, it, vi } from "vitest";
import { searchWithExactIssueMatch } from "@/api/search";
import type { RedmineClient } from "@/api/client";

function mockClient(GET: ReturnType<typeof vi.fn>): RedmineClient {
  return { GET } as unknown as RedmineClient;
}

/** Ответ /issues/{id}.json - только поля, которые реально читает searchWithExactIssueMatch. */
function issueResponse(id: number, subject: string) {
  return {
    data: {
      issue: { id, subject, updated_on: "2026-08-01T00:00:00Z" },
    },
  };
}

function searchResponse(
  results: Array<{ id: number; title: string; type: string; url: string }>,
) {
  return {
    data: {
      results: results.map((r) => ({
        ...r,
        description: null,
        datetime: "2026-08-01T00:00:00Z",
      })),
    },
  };
}

describe("searchWithExactIssueMatch", () => {
  it("числовой запрос с существующей задачей - точное совпадение первым, дубль из текстового поиска убран", async () => {
    const GET = vi.fn((path: string) => {
      if (path === "/issues/{issue_id}.{format}") {
        return Promise.resolve(issueResponse(123, "Точная задача"));
      }
      // /search.{format} - "123" где-то в тексте другой задачи + сама точная задача текстом
      return Promise.resolve(
        searchResponse([
          { id: 456, title: "Что-то про 123", type: "issue", url: "http://host/issues/456" },
          { id: 123, title: "Точная задача", type: "issue", url: "http://host/issues/123" },
        ]),
      );
    });

    const results = await searchWithExactIssueMatch(mockClient(GET), "123");

    expect(results[0]).toMatchObject({ id: 123, title: "Точная задача", type: "issue" });
    expect(results.filter((r) => r.id === 123)).toHaveLength(1);
    expect(results.map((r) => r.id)).toEqual([123, 456]);
  });

  it("текстовый запрос (не число) - без похода за точным id, только полнотекстовый поиск", async () => {
    const GET = vi.fn((path: string) => {
      if (path === "/issues/{issue_id}.{format}") {
        throw new Error("не должно вызываться для нечислового запроса");
      }
      return Promise.resolve(
        searchResponse([{ id: 1, title: "баг в поиске", type: "issue", url: "http://host/issues/1" }]),
      );
    });

    const results = await searchWithExactIssueMatch(mockClient(GET), "баг");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 1 });
  });

  it("число, но задачи с таким id нет - тихо деградирует к текстовым результатам", async () => {
    const GET = vi.fn((path: string) => {
      if (path === "/issues/{issue_id}.{format}") {
        return Promise.resolve({ data: null, error: { message: "Not Found" } });
      }
      return Promise.resolve(searchResponse([]));
    });

    const results = await searchWithExactIssueMatch(mockClient(GET), "999999");

    expect(results).toEqual([]);
  });

  it("текстовый поиск упал, но точное совпадение по id есть - возвращает хотя бы его", async () => {
    const GET = vi.fn((path: string) => {
      if (path === "/issues/{issue_id}.{format}") {
        return Promise.resolve(issueResponse(5, "Задача пять"));
      }
      return Promise.resolve({ data: null, error: { message: "boom" } });
    });

    const results = await searchWithExactIssueMatch(mockClient(GET), "5");

    expect(results).toEqual([
      {
        id: 5,
        title: "Задача пять",
        type: "issue",
        url: "/issues/5",
        description: null,
        datetime: "2026-08-01T00:00:00Z",
      },
    ]);
  });
});
