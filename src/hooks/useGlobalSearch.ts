import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { searchWithExactIssueMatch, type SearchResult } from "@/api/search";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Поиск по мере ввода для Topbar - debounce, не гоняет запрос на каждый
 * символ. Порог в 2 символа - только для текстового поиска: номер задачи
 * естественно вводить и одной цифрой (см. useIssueSearch, та же логика), для
 * чисто числового ввода ищем с первого символа.
 */
export function useGlobalSearch(client: RedmineClient | null, query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const isNumericSoFar = /^\d+$/.test(trimmed);
    const minLength = isNumericSoFar ? 1 : MIN_QUERY_LENGTH;
    if (!client || trimmed.length < minLength) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      searchWithExactIssueMatch(client, trimmed)
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
