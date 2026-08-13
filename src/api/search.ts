import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type SearchResult = components["schemas"]["search"];

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
