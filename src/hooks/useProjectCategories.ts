import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface ProjectCategory {
  id: number;
  name: string;
}

/** Категории задач текущего проекта - для дропдауна "Категория" в формах создания/правки. */
export function useProjectCategories(client: RedmineClient | null, projectId: number | null) {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || !projectId) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/projects/{project_id}/issue_categories.{format}", {
        params: { path: { format: "json", project_id: projectId } },
      })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCategories(data.issue_categories.map((c) => ({ id: c.id, name: c.name })));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return { categories, isLoading };
}
