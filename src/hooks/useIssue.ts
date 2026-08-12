import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getIssue, type Issue } from "@/api/issues";

/**
 * Загружает одну задачу по id для карточки задачи. reload() перезапрашивает
 * данные после мутации (смена статуса, комментарий) - по образцу
 * useTimeEntries.reload().
 */
export function useIssue(client: RedmineClient | null, issueId: number | null) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client || issueId === null) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getIssue(client, issueId)
      .then((data) => {
        if (cancelled) return;
        setIssue(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить задачу.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, issueId, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { issue, isLoading, error, reload };
}
