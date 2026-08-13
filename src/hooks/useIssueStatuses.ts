import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface IssueStatus {
  id: number;
  name: string;
  isClosed: boolean;
}

/** Справочник статусов задач - глобальный в Redmine (не per-project), для колонок канбана и фильтров. */
export function useIssueStatuses(client: RedmineClient | null) {
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setStatuses([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/issue_statuses.{format}", { params: { path: { format: "json" } } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setStatuses(
          data.issue_statuses.map((s) => ({
            id: s.id,
            name: s.name,
            isClosed: s.is_closed,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { statuses, isLoading };
}
