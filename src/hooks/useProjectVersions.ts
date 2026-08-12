import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface ProjectVersion {
  id: number;
  name: string;
}

/** Версии (релизы) текущего проекта - для дропдауна "Версия" в формах создания/правки. */
export function useProjectVersions(client: RedmineClient | null, projectId: number | null) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || !projectId) {
      setVersions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/projects/{project_id}/versions.{format}", {
        params: { path: { format: "json", project_id: projectId } },
      })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setVersions(data.versions.map((v) => ({ id: v.id, name: v.name })));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return { versions, isLoading };
}
