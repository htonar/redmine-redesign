import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface IssuePriority {
  id: number;
  name: string;
  isDefault: boolean;
}

/** Справочник приоритетов задач - для форм создания/правки. */
export function useIssuePriorities(client: RedmineClient | null) {
  const [priorities, setPriorities] = useState<IssuePriority[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setPriorities([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/enumerations/issue_priorities.{format}", { params: { path: { format: "json" } } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPriorities(
          data.issue_priorities.map((p) => ({ id: p.id, name: p.name, isDefault: p.is_default })),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { priorities, isLoading };
}
