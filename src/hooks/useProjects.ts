import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface Project {
  id: number;
  name: string;
  /** id родительского проекта (Redmine поддерживает иерархию) - для отступов в селекторе. */
  parentId: number | null;
}

/** Список проектов для селектора в Topbar - используется и как фильтр задач. */
export function useProjects(client: RedmineClient | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/projects.{format}", {
        params: { path: { format: "json" }, query: { limit: 100 } },
      })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProjects(
          data.projects.map((p) => ({
            id: p.id,
            name: p.name,
            parentId: p.parent?.id ?? null,
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

  return { projects, isLoading };
}
