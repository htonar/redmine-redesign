import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type IssueSummary = components["schemas"]["issue.summary"];
export type Issue = components["schemas"]["issue"];

export interface IssueListFilters {
  projectId?: number;
  /** "me" - только свои задачи, "all" - без фильтра по исполнителю. */
  assignee: "me" | "all";
  /** open/closed - как в статус-фильтре Redmine (o/c), all - без фильтра (*). */
  status: "open" | "closed" | "all";
  /** Формат Redmine: `field:desc`, например `updated_on:desc`. */
  sort: string;
}

export interface IssueListParams extends IssueListFilters {
  offset: number;
  limit: number;
}

export interface IssueListResult {
  issues: IssueSummary[];
  totalCount: number;
}

const STATUS_QUERY: Record<IssueListFilters["status"], string | undefined> = {
  open: "o",
  closed: "c",
  all: "*",
};

export async function listIssues(
  client: RedmineClient,
  params: IssueListParams,
): Promise<IssueListResult> {
  const { data, error } = await client.GET("/issues.{format}", {
    params: {
      path: { format: "json" },
      query: {
        offset: params.offset,
        limit: params.limit,
        sort: params.sort,
        project_id: params.projectId ? String(params.projectId) : undefined,
        assigned_to_id: params.assignee === "me" ? "me" : undefined,
        status_id: STATUS_QUERY[params.status],
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить список задач.");
  }

  return { issues: data.issues, totalCount: data.total_count ?? data.issues.length };
}

/** Карточка задачи - все поля + история изменений и доступные для текущего пользователя переходы статуса. */
export async function getIssue(client: RedmineClient, id: number): Promise<Issue> {
  const { data, error } = await client.GET("/issues/{issue_id}.{format}", {
    params: {
      path: { format: "json", issue_id: id },
      query: { include: ["journals", "allowed_statuses"] },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить задачу.");
  }

  return data.issue;
}

export interface IssueUpdateInput {
  statusId?: number;
  /** Текст комментария. Пустая строка/undefined - без добавления заметки. */
  notes?: string;
}

/** Смена статуса и/или добавление комментария - минимальная правка карточки, см. CLAUDE.md. */
export async function updateIssue(
  client: RedmineClient,
  id: number,
  input: IssueUpdateInput,
): Promise<void> {
  const { error } = await client.PUT("/issues/{issue_id}.{format}", {
    params: { path: { format: "json", issue_id: id } },
    body: {
      issue: {
        status_id: input.statusId,
        notes: input.notes || undefined,
      },
    },
  });

  if (error) {
    throw new Error("Не удалось обновить задачу.");
  }
}
