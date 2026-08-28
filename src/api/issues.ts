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
  /**
   * "me" - только задачи, за которыми пользователь следит как наблюдатель
   * (`watcher_id=me`, см. Redmine REST API - недокументирован в основном
   * описании ресурса, но есть в списке фильтров). Не задан - без фильтра по
   * наблюдателям. Используется поллингом уведомлений (issue #3), не UI
   * списка задач.
   */
  watcher?: "me";
  /** Фильтр по трекеру (`tracker_id`). */
  trackerId?: number;
  /** Фильтр по приоритету (`priority_id`). */
  priorityId?: number;
  /** Фильтр по целевой версии (`fixed_version_id`) - осмыслен при выбранном проекте. */
  versionId?: number;
  /** Фильтр по автору задачи (`author_id`). */
  authorId?: number;
  /**
   * Поиск по теме - подстрокой. Отправляется как `subject=~text` (оператор
   * "содержит" в синтаксисе фильтров Redmine). Пустая строка = без фильтра.
   */
  subject?: string;
  /** Формат Redmine: `field:desc`, например `updated_on:desc`. */
  sort: string;
  /**
   * Фильтр по дате создания (`created_on`), YYYY-MM-DD - для отчётов за
   * период (issue #58). Отправляется оператором `>=` / `<=`; если заданы обе
   * границы - `><from|to`.
   */
  createdFrom?: string;
  createdTo?: string;
  /**
   * Id нативного Query Redmine (`GET /queries.json`, см. src/api/queries.ts,
   * issue #14). Когда задан, `listIssues` отправляет только `query_id` -
   * Redmine применяет фильтры самого query и игнорирует остальные параметры
   * фильтрации на сервере, так что отправлять их вместе означало бы вводить
   * пользователя в заблуждение, будто они применяются одновременно.
   */
  queryId?: number;
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

/** Синтаксис фильтра дат Redmine: `>=d`, `<=d` или `><from|to` при обеих границах. */
function createdOnFilter(
  from: string | undefined,
  to: string | undefined,
): string | undefined {
  if (from && to) return `><${from}|${to}`;
  if (from) return `>=${from}`;
  if (to) return `<=${to}`;
  return undefined;
}

export async function listIssues(
  client: RedmineClient,
  params: IssueListParams,
): Promise<IssueListResult> {
  const { data, error } = await client.GET("/issues.{format}", {
    params: {
      path: { format: "json" },
      query: params.queryId
        ? {
            offset: params.offset,
            limit: params.limit,
            sort: params.sort,
            query_id: params.queryId,
          }
        : {
            offset: params.offset,
            limit: params.limit,
            sort: params.sort,
            project_id: params.projectId ? String(params.projectId) : undefined,
            assigned_to_id: params.assignee === "me" ? "me" : undefined,
            status_id: STATUS_QUERY[params.status],
            watcher_id: params.watcher === "me" ? "me" : undefined,
            tracker_id: params.trackerId ? String(params.trackerId) : undefined,
            priority_id: params.priorityId
              ? String(params.priorityId)
              : undefined,
            fixed_version_id: params.versionId
              ? String(params.versionId)
              : undefined,
            author_id: params.authorId ? String(params.authorId) : undefined,
            subject: params.subject?.trim()
              ? `~${params.subject.trim()}`
              : undefined,
            created_on: createdOnFilter(
              params.createdFrom,
              params.createdTo,
            ),
          },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить список задач.");
  }

  return {
    issues: data.issues,
    totalCount: data.total_count ?? data.issues.length,
  };
}

const LIST_ALL_PAGE_LIMIT = 100; // максимум за один запрос в Redmine REST API
/** Защита от сотен последовательных запросов на аномально большом проекте. */
const LIST_ALL_MAX_ISSUES = 1000;

export interface ListAllIssuesResult {
  issues: IssueSummary[];
  totalCount: number;
  /** true - показаны не все задачи проекта (уперлись в защитный лимит или сервер отдал меньше totalCount). */
  isCapped: boolean;
}

/**
 * Полная постраничная подгрузка всех задач под фильтр (в отличие от
 * `listIssues`, который отдает одну страницу) - для мест, которым нужен
 * точный счет по всем задачам, а не витрина с пагинацией (см. GitHub issue
 * #13, "Отчёты"). `useKanbanIssues` намеренно берет только одну страницу на
 * 100 - канбану точный тотал не нужен, отчету нужен.
 */
export async function listAllIssues(
  client: RedmineClient,
  filters: IssueListFilters,
): Promise<ListAllIssuesResult> {
  let issues: IssueSummary[] = [];
  let totalCount = 0;
  let offset = 0;

  while (offset < LIST_ALL_MAX_ISSUES) {
    const page = await listIssues(client, {
      ...filters,
      offset,
      limit: LIST_ALL_PAGE_LIMIT,
    });
    totalCount = page.totalCount;
    issues = issues.concat(page.issues);
    offset += LIST_ALL_PAGE_LIMIT;

    // Пустая страница раньше totalCount - сервер противоречит сам себе,
    // обрываем цикл вместо бесконечных запросов по нулю новых issues.
    if (page.issues.length === 0) break;
    if (offset >= totalCount) break;
  }

  return { issues, totalCount, isCapped: issues.length < totalCount };
}

/** Карточка задачи - все поля + история изменений, подзадачи, связи и доступные для текущего пользователя переходы статуса. */
export async function getIssue(
  client: RedmineClient,
  id: number,
): Promise<Issue> {
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
export async function getIssueSummary(
  client: RedmineClient,
  id: number,
): Promise<IssueSummary> {
  const { data, error } = await client.GET("/issues/{issue_id}.{format}", {
    params: { path: { format: "json", issue_id: id } },
  });

  if (error || !data) {
    throw new Error(`Не удалось загрузить задачу #${id}.`);
  }

  return data.issue;
}

export type IssueJournal = NonNullable<Issue["journals"]>[number];

/**
 * Только история изменений задачи (без остальных include) - для ленты
 * активности на дашборде (useActivityFeed), где нужны journals по нескольким
 * задачам сразу и лишние include (attachments, relations, watchers...)
 * только увеличили бы вес запроса без пользы.
 */
export async function getIssueJournal(
  client: RedmineClient,
  id: number,
): Promise<{ issue: IssueSummary; journals: IssueJournal[] }> {
  const { data, error } = await client.GET("/issues/{issue_id}.{format}", {
    params: {
      path: { format: "json", issue_id: id },
      query: { include: ["journals"] },
    },
  });

  if (error || !data) {
    throw new Error(`Не удалось загрузить историю задачи #${id}.`);
  }

  return { issue: data.issue, journals: data.issue.journals ?? [] };
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
  /**
   * Пользовательские поля - {id, value}, value - строка или массив строк для
   * полей с multiple. См. src/api/customFields.ts, CLAUDE.md ("Custom fields").
   */
  customFields?: { id: number; value: string | string[] | null }[];
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
        custom_fields: input.customFields,
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
        custom_fields: input.customFields,
      },
    },
  });

  if (error) {
    throw new Error("Не удалось обновить задачу.");
  }
}

/**
 * Удаление задачи. Требует право `delete_issues` на проекте задачи - у этого
 * права нет варианта "только свои" (в отличие от заметок), см.
 * docs/permissions.md. Серверная проверка (403) остается финальным
 * решением - клиентская (AuthContext.can) только прячет кнопку заранее.
 */
export async function deleteIssue(
  client: RedmineClient,
  id: number,
): Promise<void> {
  const { error, response } = await client.DELETE(
    "/issues/{issue_id}.{format}",
    {
      params: { path: { format: "json", issue_id: id } },
    },
  );

  if (error) {
    if (response.status === 403) {
      throw new Error("Недостаточно прав для удаления этой задачи.");
    }
    throw new Error("Не удалось удалить задачу.");
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
  const { data, error } = await client.POST(
    "/issues/{issue_id}/relations.{format}",
    {
      params: { path: { format: "json", issue_id: issueId } },
      body: {
        relation: {
          issue_to_id: input.issueToId,
          relation_type: input.relationType,
          delay: input.delay ?? undefined,
        },
      },
    },
  );

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
  const { error } = await client.DELETE(
    "/relations/{issue_relation_id}.{format}",
    {
      params: { path: { format: "json", issue_relation_id: relationId } },
    },
  );

  if (error) {
    throw new Error("Не удалось удалить связь.");
  }
}
