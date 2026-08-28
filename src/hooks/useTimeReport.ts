import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listAllTimeEntries } from "@/api/timeEntries";
import { buildTimeReport, type TimeReport } from "@/lib/time-report";

/**
 * Отчёт по трудозатратам одного проекта за период (issue #57): полная
 * подгрузка time_entries + чистая агрегация buildTimeReport. `scope` -
 * "all" (все исполнители) или "me".
 */
export function useTimeReport(
  client: RedmineClient | null,
  projectId: number | null,
  range: { from?: string; to?: string },
  scope: "me" | "all" = "all",
) {
  const [report, setReport] = useState<TimeReport | null>(null);
  const [isCapped, setIsCapped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { from, to } = range;

  useEffect(() => {
    if (!client || !projectId) {
      setReport(null);
      setIsCapped(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listAllTimeEntries(client, { scope, projectId, from, to })
      .then(({ entries, isCapped: capped }) => {
        if (cancelled) return;
        setReport(buildTimeReport(entries));
        setIsCapped(capped);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Не удалось построить отчёт по времени.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, from, to, scope, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { report, isCapped, isLoading, error, reload };
}
