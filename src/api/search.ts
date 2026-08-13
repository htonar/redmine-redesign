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
