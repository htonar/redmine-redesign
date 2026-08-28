import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listIssues, type IssueListFilters, type IssueSummary } from "@/api/issues";

const PAGE_SIZE = 25;

/**
 * Загружает список задач по фильтрам с подгрузкой "показать еще". Полностью
 * перезапрашивает с offset=0 при смене client/filters - постраничная
 * подгрузка работает только вперед, внутри одного набора фильтров.
 */
export function useIssues(client: RedmineClient | null, filters: IssueListFilters) {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listIssues(client, { ...filters, offset: 0, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setIssues(result.issues);
        setTotalCount(result.totalCount);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить задачи.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // filters сравниваются через filtersKey ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filtersKey]);

  async function loadMore() {
    if (!client || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await listIssues(client, {
        ...filters,
        offset: issues.length,
        limit: PAGE_SIZE,
      });
      setIssues((prev) => [...prev, ...result.issues]);
      setTotalCount(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить задачи.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  /**
   * Точечно обновить одну задачу в уже загруженном списке (issue #36 -
   * инлайн-смена статуса/исполнителя): оптимистичный апдейт без перезапроса
   * всего списка. `patch` мержится поверх текущей записи.
   */
  function patchIssue(id: number, patch: Partial<IssueSummary>) {
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, ...patch } : issue)),
    );
  }

  return {
    issues,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore: issues.length < totalCount,
    loadMore,
    patchIssue,
  };
}
