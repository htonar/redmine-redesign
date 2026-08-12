import { useCallback, useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listTimeEntries, type TimeEntry, type TimeEntryListFilters } from "@/api/timeEntries";

const PAGE_SIZE = 50;

/**
 * Загружает записи времени по фильтрам с подгрузкой "показать еще", по
 * образцу useIssues.ts. Дополнительно дает reload() - перезапросить с начала
 * после создания/правки/удаления записи, не меняя фильтры.
 */
export function useTimeEntries(client: RedmineClient | null, filters: TimeEntryListFilters) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listTimeEntries(client, { ...filters, offset: 0, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setTotalCount(result.totalCount);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить записи времени.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // filters сравниваются через filtersKey ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filtersKey, reloadToken]);

  async function loadMore() {
    if (!client || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await listTimeEntries(client, {
        ...filters,
        offset: entries.length,
        limit: PAGE_SIZE,
      });
      setEntries((prev) => [...prev, ...result.entries]);
      setTotalCount(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить записи времени.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    entries,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore: entries.length < totalCount,
    loadMore,
    reload,
  };
}
