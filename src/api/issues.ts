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

/** Карточка задачи - все поля + история изменений, подзадачи, связи и доступные для текущего пользователя переходы статуса. */
export async function getIssue(client: RedmineClient, id: number): Promise<Issue> {
  const { data, error } = await client.GET("/issues/{issue_id}.{format}", {
    params: {
      path: { format: "json", issue_id: id },
      query: {
        include: [
          "journals",
          "allowed_statuses",
          "children",
          "relations",
          "attachments",
          "watchers",
        ],
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить задачу.");
  }

  return data.issue;
}

/**
 * Краткая карточка задачи (тема/трекер/статус/проект), без include - для
 * отображения ссылки на родителя/связанную задачу, когда есть только её id
 * (issue.parent и issue.relations отдают только { id }, без темы).
 */
export async function getIssueSummary(client: RedmineClient, id: number): Promise<IssueSummary> {
  const { data, error } = await client.GET("/issues/{issue_id}.{format}", {
    params: { path: { format: "json", issue_id: id } },
  });

  if (error || !data) {
    throw new Error(`Не удалось загрузить задачу #${id}.`);
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
  /** Родительская задача (подзадача чего-то) - `null` явно убирает родителя. */
  parentId?: number | null;
  /**
   * Новые файлы для прикрепления - сначала грузятся байты через
   * uploadAttachment (src/api/attachments.ts, POST /uploads), затем
   * полученный token передается сюда вместе с create/update. Удаление уже
   * прикрепленного файла - отдельный DELETE /attachments/{id}
   * (deleteAttachment), не через этот массив.
   */
  uploads?: { token: string; filename: string; contentType?: string }[];
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
        parent_issue_id: input.parentId,
        uploads: input.uploads?.map((u) => ({
          token: u.token,
          filename: u.filename,
          content_type: u.contentType,
        })),
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
        parent_issue_id: input.parentId,
        uploads: input.uploads?.map((u) => ({
          token: u.token,
          filename: u.filename,
          content_type: u.contentType,
        })),
      },
    },
  });

  if (error) {
    throw new Error("Не удалось обновить задачу.");
  }
}

export type IssueRelationType =
  | "relates"
  | "duplicates"
  | "duplicated"
  | "blocks"
  | "blocked"
  | "precedes"
  | "follows"
  | "copied_to"
  | "copied_from";

export type IssueRelation = components["schemas"]["issue_relation"];

export interface IssueRelationInput {
  issueToId: number;
  relationType: IssueRelationType;
  delay?: number | null;
}

/** Добавление связи между текущей задачей и другой - см. CLAUDE.md, "Подзадачи и связи задач". */
export async function createIssueRelation(
  client: RedmineClient,
  issueId: number,
  input: IssueRelationInput,
): Promise<IssueRelation> {
  const { data, error } = await client.POST("/issues/{issue_id}/relations.{format}", {
    params: { path: { format: "json", issue_id: issueId } },
    body: {
      relation: {
        issue_to_id: input.issueToId,
        relation_type: input.relationType,
        delay: input.delay ?? undefined,
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось добавить связь - проверьте номер задачи.");
  }

  return data.relation;
}

/** Удаление связи по id самой связи (не задачи). */
export async function deleteIssueRelation(
  client: RedmineClient,
  relationId: number,
): Promise<void> {
  const { error } = await client.DELETE("/relations/{issue_relation_id}.{format}", {
    params: { path: { format: "json", issue_relation_id: relationId } },
  });

  if (error) {
    throw new Error("Не удалось удалить связь.");
  }
}
