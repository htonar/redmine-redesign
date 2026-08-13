import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getIssueSummary, type IssueSummary } from "@/api/issues";
import { searchIssues } from "@/api/search";

export interface IssueSearchResult {
  id: number;
  subject: string;
  /** Точное совпадение по номеру (из getIssueSummary) - показываем первым, отдельно от текстовых совпадений. */
  isExactId: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** id из текста результата /search.json ("http://host/issues/123") - см. GlobalSearch.tsx, тот же прием. */
function issueIdFromUrl(url: string): number | null {
  const match = url.match(/\/issues\/(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

/**
 * Подсказки для поля "№ задачи" - см. IssuePicker. Если запрос - чистое
 * число, отдельно проверяем его как id через getIssueSummary (быстрый прямой
 * GET), чтобы сразу показать реальную тему задачи и подтвердить, что номер
 * существует - иначе вводить номер "вслепую" неудобно (см. CLAUDE.md).
 * Плюс полнотекстовый поиск по теме/описанию через /search.json?issues=1.
 */
export function useIssueSearch(
  client: RedmineClient | null,
  query: string,
  projectId?: number | null,
) {
  const [results, setResults] = useState<IssueSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    // Порог в 2 символа - только для текстового поиска (иначе на каждую
    // букву в "issues.json" уходил бы почти пустой запрос). Номер задачи
    // естественно вводить и одной цифрой (задача #1, #5...), поэтому для
    // чисто числового ввода ищем с первого символа.
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
      const asId = /^\d+$/.test(trimmed) ? Number(trimmed) : null;

      Promise.all([
        asId
          ? getIssueSummary(client, asId).catch(() => null)
          : Promise.resolve<IssueSummary | null>(null),
        searchIssues(client, trimmed, projectId ?? undefined).catch(() => []),
      ])
        .then(([exact, textMatches]) => {
          if (cancelled) return;

          const results: IssueSearchResult[] = [];
          if (exact) {
            results.push({ id: exact.id, subject: exact.subject, isExactId: true });
          }
          for (const r of textMatches) {
            const id = issueIdFromUrl(r.url);
            if (id === null || id === exact?.id) continue;
            results.push({ id, subject: r.title, isExactId: false });
          }
          setResults(results);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, query, projectId]);

  return { results, isLoading };
}
