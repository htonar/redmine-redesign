import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type TimeEntry = components["schemas"]["time_entry"];

export interface TimeEntryListFilters {
  /** "me" - только свои записи, "all" - без фильтра по пользователю. */
  scope: "me" | "all";
  projectId?: number;
  /**
   * Шорткаты Redmine для фильтра spent_on: `t` - сегодня, `w` - эта неделя,
   * `m` - этот месяц. undefined - без ограничения по дате.
   */
  spentOn?: "t" | "w" | "m";
  /** Явный диапазон дат YYYY-MM-DD (для произвольной недели, см. useWeeklyTimeDebt). */
  from?: string;
  to?: string;
}

export interface TimeEntryListParams extends TimeEntryListFilters {
  offset: number;
  limit: number;
}

export interface TimeEntryListResult {
  entries: TimeEntry[];
  totalCount: number;
}

/** Данные формы создания/правки записи - issueId или projectId должен быть задан. */
export interface TimeEntryInput {
  issueId?: number;
  projectId?: number;
  /** Формат YYYY-MM-DD. */
  spentOn: string;
  hours: number;
  activityId?: number;
  comments?: string;
}

export async function listTimeEntries(
  client: RedmineClient,
  params: TimeEntryListParams,
): Promise<TimeEntryListResult> {
  const { data, error } = await client.GET("/time_entries.{format}", {
    params: {
      path: { format: "json" },
      query: {
        offset: params.offset,
        limit: params.limit,
        sort: "spent_on:desc",
        user_id: params.scope === "me" ? "me" : undefined,
        project_id: params.projectId ? String(params.projectId) : undefined,
        spent_on: params.spentOn,
        from: params.from,
        to: params.to,
      },
    },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить записи времени.");
  }

  return { entries: data.time_entries, totalCount: data.total_count ?? data.time_entries.length };
}

const TE_PAGE_LIMIT = 100;
const TE_MAX_ENTRIES = 5000;

export interface ListAllTimeEntriesResult {
  entries: TimeEntry[];
  totalCount: number;
  /** true - показаны не все записи (уперлись в защитный лимит). */
  isCapped: boolean;
}

/**
 * Полная постраничная подгрузка записей времени под фильтр - для отчёта по
 * трудозатратам (issue #57), где нужна точная сумма по всем записям периода,
 * а не витрина с пагинацией.
 */
export async function listAllTimeEntries(
  client: RedmineClient,
  filters: TimeEntryListFilters,
): Promise<ListAllTimeEntriesResult> {
  let entries: TimeEntry[] = [];
  let totalCount = 0;
  let offset = 0;

  while (offset < TE_MAX_ENTRIES) {
    const page = await listTimeEntries(client, {
      ...filters,
      offset,
      limit: TE_PAGE_LIMIT,
    });
    totalCount = page.totalCount;
    entries = entries.concat(page.entries);
    offset += TE_PAGE_LIMIT;
    if (page.entries.length === 0) break;
    if (offset >= totalCount) break;
  }

  return { entries, totalCount, isCapped: entries.length < totalCount };
}

function toRequestBody(input: TimeEntryInput) {
  return {
    issue_id: input.issueId,
    project_id: input.issueId ? undefined : input.projectId,
    spent_on: input.spentOn,
    hours: input.hours,
    activity_id: input.activityId,
    comments: input.comments || undefined,
  };
}

export async function createTimeEntry(
  client: RedmineClient,
  input: TimeEntryInput,
): Promise<TimeEntry> {
  const { data, error } = await client.POST("/time_entries.{format}", {
    params: { path: { format: "json" } },
    body: { time_entry: toRequestBody(input) },
  });

  if (error || !data) {
    throw new Error("Не удалось сохранить запись времени.");
  }

  return data.time_entry;
}

export async function updateTimeEntry(
  client: RedmineClient,
  id: number,
  input: TimeEntryInput,
): Promise<void> {
  const { error } = await client.PUT("/time_entries/{time_entry_id}.{format}", {
    params: { path: { format: "json", time_entry_id: id } },
    body: { time_entry: toRequestBody(input) },
  });

  if (error) {
    throw new Error("Не удалось обновить запись времени.");
  }
}

export async function deleteTimeEntry(client: RedmineClient, id: number): Promise<void> {
  const { error } = await client.DELETE("/time_entries/{time_entry_id}.{format}", {
    params: { path: { format: "json", time_entry_id: id } },
  });

  if (error) {
    throw new Error("Не удалось удалить запись времени.");
  }
}
