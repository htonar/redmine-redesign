import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { search, type SearchResult } from "@/api/search";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Поиск по мере ввода для Topbar - debounce, не гоняет запрос на каждый символ. */
export function useGlobalSearch(client: RedmineClient | null, query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!client || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      search(client, trimmed)
        .then((data) => {
          if (cancelled) return;
          setResults(data);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, query]);

  return { results, isLoading };
}
