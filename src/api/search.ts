import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";
import { getIssueSummary } from "@/api/issues";

export type SearchResult = components["schemas"]["search"];

/**
 * Тип фильтра для страницы поиска (issue #43). Соответствие "флаг запроса
 * `/search.json`" -> "значения `type` в результатах".
 */
export type SearchTypeFilter =
  | "all"
  | "issues"
  | "projects"
  | "wiki_pages"
  | "news"
  | "documents"
  | "messages";

export interface SearchPageParams {
  q: string;
  offset: number;
  limit: number;
  /** "all" - без ограничения по типу; иначе только выбранный тип. */
  type?: SearchTypeFilter;
  openIssuesOnly?: boolean;
}

export interface SearchPageResult {
  results: SearchResult[];
  totalCount: number;
}

/**
 * Полная страница результатов поиска - GET /search.json с пагинацией
 * (offset/limit) и счётчиком (total_count). В отличие от `search` выше
 * (подсказки в Topbar), это отдельный экран.
 */
export async function searchPage(
  client: RedmineClient,
  params: SearchPageParams,
): Promise<SearchPageResult> {
  const typeFlag =
    params.type && params.type !== "all"
      ? ({ [params.type]: 1 } as Record<string, 1>)
      : {};
  const { data, error } = await client.GET("/search.{format}", {
    params: {
      path: { format: "json" },
      query: {
        q: params.q,
        offset: params.offset,
        limit: params.limit,
        ...typeFlag,
        open_issues: params.openIssuesOnly ? "1" : undefined,
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось выполнить поиск.");
  }

  return {
    results: data.results,
    totalCount: data.total_count ?? data.results.length,
  };
}

/** Глобальный поиск - GET /search.json. limit небольшой - это подсказки в Topbar, не отдельная страница результатов. */
export async function search(client: RedmineClient, query: string): Promise<SearchResult[]> {
  const { data, error } = await client.GET("/search.{format}", {
    params: { path: { format: "json" }, query: { q: query, limit: 10 } },
  });

  if (error || !data) {
    throw new Error("Не удалось выполнить поиск.");
  }

  return data.results;
}

/**
 * Поиск только по задачам (для подсказок в полях "№ задачи" - см.
 * IssuePicker) - `issues=1` отключает news/wiki/documents/... в общем
 * /search.json. Если задан `projectId` - ищем в рамках одного проекта
 * (`/projects/{id}/search.json`), иначе - по всем.
 */
export async function searchIssues(
  client: RedmineClient,
  query: string,
  projectId?: number,
): Promise<SearchResult[]> {
  if (projectId) {
    const { data, error } = await client.GET("/projects/{project_id}/search.{format}", {
      params: {
        path: { format: "json", project_id: projectId },
        query: { q: query, limit: 10, issues: 1 },
      },
    });
    if (error || !data) throw new Error("Не удалось выполнить поиск.");
    return data.results;
  }

  const { data, error } = await client.GET("/search.{format}", {
    params: { path: { format: "json" }, query: { q: query, limit: 10, issues: 1 } },
  });
  if (error || !data) throw new Error("Не удалось выполнить поиск.");
  return data.results;
}

/**
 * Глобальный поиск (Topbar) с точным id-lookup для чисто числового запроса -
 * см. issue #19. `/search.json` ищет "123" как текст по теме/описанию, а не
 * как номер задачи - отсюда промах на реально существующем номере и
 * посторонние текстовые совпадения в подсказках. `searchIssues`/
 * `useIssueSearch` эту проблему для поля "№ задачи" уже решают отдельным
 * прямым GET по id - здесь то же самое для общего поиска по всем типам
 * сущностей: если запрос - чистое число, точное совпадение идет первым
 * пунктом (дубль по id из полнотекстовых результатов убираем).
 */
export async function searchWithExactIssueMatch(
  client: RedmineClient,
  query: string,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  const asId = /^\d+$/.test(trimmed) ? Number(trimmed) : null;

  const [exact, textMatches] = await Promise.all([
    asId ? getIssueSummary(client, asId).catch(() => null) : Promise.resolve(null),
    search(client, trimmed).catch(() => []),
  ]);

  if (!exact) return textMatches;

  const exactResult: SearchResult = {
    id: exact.id,
    title: exact.subject,
    type: "issue",
    url: `/issues/${exact.id}`,
    description: null,
    datetime: exact.updated_on,
  };

  const rest = textMatches.filter((r) => !(r.type === "issue" && r.id === exact.id));
  return [exactResult, ...rest];
}
