import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getIssueJournal, listIssues, type IssueJournal } from "@/api/issues";

export interface ActivityEntry {
  issueId: number;
  issueSubject: string;
  journal: IssueJournal;
}

/** Сколько последних обновленных (моих) задач просматриваем в поисках изменений. */
const RECENT_ISSUES_LIMIT = 10;
/** Сколько записей истории показываем в итоговой ленте, суммарно по всем задачам. */
const FEED_ENTRIES_LIMIT = 20;

/**
 * Лента активности по своим задачам - CLAUDE.md, "Приоритеты дальше", п.4.
 * Отдельного activity-эндпоинта в REST API Redmine нет, поэтому лента
 * собирается на фронте: берем N последних обновленных задач на пользователе
 * (`GET /issues.json?assigned_to_id=me&sort=updated_on:desc`), для каждой
 * подгружаем journals (история изменений/комментарии) и сливаем все записи в
 * одну хронологическую ленту. N+1 запросов, но N небольшой (10) и это разовая
 * загрузка дашборда, не список с пагинацией.
 */
export function useActivityFeed(client: RedmineClient | null, projectId?: number) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listIssues(client, {
      projectId,
      assignee: "me",
      status: "all",
      sort: "updated_on:desc",
      offset: 0,
      limit: RECENT_ISSUES_LIMIT,
    })
      .then(async ({ issues }) => {
        // Одна упавшая задача не должна ронять всю ленту - пропускаем её.
        const perIssue = await Promise.all(
          issues.map((issue) => getIssueJournal(client, issue.id).catch(() => null)),
        );
        if (cancelled) return;

        const flattened: ActivityEntry[] = [];
        for (const result of perIssue) {
          if (!result) continue;
          for (const journal of result.journals) {
            if (!journal.notes && journal.details.length === 0) continue;
            flattened.push({
              issueId: result.issue.id,
              issueSubject: result.issue.subject,
              journal,
            });
          }
        }
        flattened.sort((a, b) => (a.journal.created_on < b.journal.created_on ? 1 : -1));
        setEntries(flattened.slice(0, FEED_ENTRIES_LIMIT));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить активность.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return { entries, isLoading, error };
}
