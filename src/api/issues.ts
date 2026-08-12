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

/**
 * Поля, общие для создания и правки задачи - см. IssueFormFields
 * (src/components/issues/IssueFormFields.tsx), который редактирует именно
 * этот набор. `null` у nullable-полей - явная очистка значения (например,
 * "снять исполнителя"), `undefined` - поле не участвует в запросе.
 */
export interface IssueFieldsInput {
  trackerId?: number;
  statusId?: number;
  priorityId?: number;
  subject?: string;
  description?: string | null;
  assignedToId?: number | null;
  categoryId?: number | null;
  fixedVersionId?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  doneRatio?: number;
  estimatedHours?: number | null;
}

export interface IssueCreateInput extends IssueFieldsInput {
  projectId: number;
  subject: string;
}

/** Создание новой задачи - см. CLAUDE.md. */
export async function createIssue(
  client: RedmineClient,
  input: IssueCreateInput,
): Promise<IssueSummary> {
  const { data, error } = await client.POST("/issues.{format}", {
    params: { path: { format: "json" } },
    body: {
      issue: {
        project_id: input.projectId,
        subject: input.subject,
        tracker_id: input.trackerId,
        status_id: input.statusId,
        priority_id: input.priorityId,
        description: input.description,
        assigned_to_id: input.assignedToId,
        category_id: input.categoryId,
        fixed_version_id: input.fixedVersionId,
        start_date: input.startDate,
        due_date: input.dueDate,
        done_ratio: input.doneRatio,
        estimated_hours: input.estimatedHours,
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось создать задачу.");
  }

  return data.issue;
}

export interface IssueUpdateInput extends IssueFieldsInput {
  /** Текст комментария. Пустая строка/undefined - без добавления заметки. */
  notes?: string;
}

/**
 * Правка задачи - смена статуса, комментарий и/или любые другие поля
 * (тема, описание, исполнитель, приоритет, трекер, даты, категория, версия,
 * готовность, оценка часов). Отправляются только заданные поля.
 */
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
        tracker_id: input.trackerId,
        priority_id: input.priorityId,
        subject: input.subject,
        description: input.description,
        assigned_to_id: input.assignedToId,
        category_id: input.categoryId,
        fixed_version_id: input.fixedVersionId,
        start_date: input.startDate,
        due_date: input.dueDate,
        done_ratio: input.doneRatio,
        estimated_hours: input.estimatedHours,
      },
    },
  });

  if (error) {
    throw new Error("Не удалось обновить задачу.");
  }
}
