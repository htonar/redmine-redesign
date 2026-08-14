import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listQueries, type QuerySummary } from "@/api/queries";

/**
 * Нативные сохраненные запросы (Query) Redmine для селектора в IssuesPage -
 * см. src/api/queries.ts, CLAUDE.md "Список задач", issue #14. Отдельно от
 * useIssueViews (свои виды, localStorage).
 */
export function useQueries(client: RedmineClient | null) {
  const [queries, setQueries] = useState<QuerySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setQueries([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    listQueries(client)
      .then((result) => {
        if (cancelled) return;
        setQueries(result);
      })
      .catch(() => {
        if (!cancelled) setQueries([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { queries, isLoading };
}
