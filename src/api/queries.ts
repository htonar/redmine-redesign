import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type QuerySummary = {
  id: number;
  name: string;
  isPublic: boolean;
  projectId: number | null;
};

type QueryDto = components["schemas"]["query"];

function toQuerySummary(dto: QueryDto): QuerySummary {
  return {
    id: dto.id,
    name: dto.name,
    isPublic: dto.is_public,
    projectId: dto.project_id,
  };
}

/**
 * Нативные сохраненные запросы (Query) самого Redmine - `GET /queries.json`.
 * Не путать со "своими" сохраненными видами (issue-views-storage.ts,
 * localStorage) - второй независимый источник, см. CLAUDE.md раздел
 * "Список задач: фильтры, сортировка, сохраненные виды" и issue #14.
 */
export async function listQueries(client: RedmineClient): Promise<QuerySummary[]> {
  const { data, error } = await client.GET("/queries.{format}", {
    params: { path: { format: "json" } },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить сохраненные запросы Redmine.");
  }

  return data.queries.map(toQuerySummary);
}
