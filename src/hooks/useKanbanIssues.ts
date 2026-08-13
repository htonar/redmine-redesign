import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listIssues, type IssueSummary } from "@/api/issues";

const LIMIT = 100; // максимум за один запрос в Redmine REST API

export interface KanbanIssuesFilters {
  projectId: number;
  assignee: "me" | "all";
  sort: string;
}

/**
 * Задачи для канбан-доски - в отличие от useIssues (таблица, постраничная
 * подгрузка), здесь всегда `status: "all"` (статус кодируется колонкой, а не
 * фильтром) и один запрос на максимальный лимит Redmine (100) без "показать
 * еще" - доска физически не тянет бесконечный список по колонкам. Если задач
 * больше 100 - `hasMore` предупреждает, что показаны не все.
 */
export function useKanbanIssues(
  client: RedmineClient | null,
  filters: KanbanIssuesFilters,
) {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listIssues(client, { ...filters, status: "all", offset: 0, limit: LIMIT })
      .then((result) => {
        if (cancelled) return;
        setIssues(result.issues);
        setTotalCount(result.totalCount);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Не удалось загрузить задачи.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // filters сравниваются через filtersKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filtersKey, reloadToken]);

  /** Локально переносит карточку в другую колонку - для мгновенного отклика на drag-n-drop, не дожидаясь ответа сервера. */
  function moveLocally(
    issueId: number,
    statusId: number,
    statusName: string,
    isClosed: boolean,
  ) {
    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              status: { id: statusId, name: statusName, is_closed: isClosed },
            }
          : issue,
      ),
    );
  }

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return {
    issues,
    totalCount,
    isLoading,
    error,
    hasMore: issues.length < totalCount,
    moveLocally,
    reload,
  };
}
