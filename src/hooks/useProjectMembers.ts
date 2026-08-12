import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface ProjectMember {
  id: number;
  name: string;
}

/**
 * Участники проекта - источник для дропдауна "Исполнитель" в формах
 * создания/правки задачи. Упрощение против самого Redmine: показываем всех
 * участников проекта, без фильтрации по роли "может быть назначен" - REST
 * API это не отдает напрямую. Группы (membership.group) пропускаем - в
 * assigned_to_id ожидается id пользователя.
 */
export function useProjectMembers(client: RedmineClient | null, projectId: number | null) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || !projectId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/projects/{project_id}/memberships.{format}", {
        params: { path: { format: "json", project_id: projectId }, query: { limit: 100 } },
      })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const users = data.memberships
          .filter((m) => m.user)
          .map((m) => ({ id: m.user!.id, name: m.user!.name }));
        setMembers(users);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return { members, isLoading };
}
