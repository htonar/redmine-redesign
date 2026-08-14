import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listAllIssues } from "@/api/issues";
import { buildIssueReport, type IssueReport } from "@/lib/issue-report";

/**
 * Сводка по задачам одного проекта - см. ReportsPage. Тонкая оркестрация
 * поверх listAllIssues (полная подгрузка) + buildIssueReport (чистая
 * агрегация) - см. GitHub issue #13.
 */
export function useIssueReport(client: RedmineClient | null, projectId: number | null) {
  const [report, setReport] = useState<IssueReport | null>(null);
  const [isCapped, setIsCapped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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

    listAllIssues(client, { projectId, assignee: "all", status: "all", sort: "id" })
      .then(({ issues, isCapped: capped }) => {
        if (cancelled) return;
        setReport(buildIssueReport(issues));
        setIsCapped(capped);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось построить отчёт.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { report, isCapped, isLoading, error, reload };
}
