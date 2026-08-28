import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import {
  searchPage,
  type SearchResult,
  type SearchTypeFilter,
} from "@/api/search";

const PAGE_SIZE = 25;

/**
 * Результаты для полноценной страницы поиска (issue #43) - с пагинацией
 * "показать ещё" и счётчиком. Перезапрашивается с offset=0 при смене
 * запроса/фильтра/типа, по образцу useIssues.
 */
export function useSearchResults(
  client: RedmineClient | null,
  query: string,
  type: SearchTypeFilter,
  openIssuesOnly: boolean,
) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!client || trimmed.length < 1) {
      setResults([]);
      setTotalCount(0);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    searchPage(client, {
      q: trimmed,
      offset: 0,
      limit: PAGE_SIZE,
      type,
      openIssuesOnly,
    })
      .then((res) => {
        if (cancelled) return;
        setResults(res.results);
        setTotalCount(res.totalCount);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось выполнить поиск.");
        setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, trimmed, type, openIssuesOnly]);

  async function loadMore() {
    if (!client || isLoadingMore || trimmed.length < 1) return;
    setIsLoadingMore(true);
    try {
      const res = await searchPage(client, {
        q: trimmed,
        offset: results.length,
        limit: PAGE_SIZE,
        type,
        openIssuesOnly,
      });
      setResults((prev) => [...prev, ...res.results]);
      setTotalCount(res.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить поиск.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return {
    results,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore: results.length < totalCount,
    loadMore,
  };
}
