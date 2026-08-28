import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface ProjectMember {
  id: number;
  name: string;
  /**
   * Email - для Gravatar-аватарки (issue #44). Redmine отдаёт `mail` в
   * `/users/{id}.json` только админам и самому пользователю, поэтому здесь
   * best-effort: на не-админской сессии у большинства участников будет
   * undefined, и аватарка откатится на инициалы.
   */
  mail?: string;
}

/**
 * Участники проекта - источник для дропдауна "Исполнитель" в формах
 * создания/правки задачи. Упрощение против самого Redmine: показываем всех
 * участников проекта, без фильтрации по роли "может быть назначен" - REST
 * API это не отдает напрямую. Группы (membership.group) пропускаем - в
 * assigned_to_id ожидается id пользователя.
 *
 * Баг, найденный вручную на локальном инстансе: `/memberships.json` не
 * включает текущего пользователя, если он не оформлен формальным участником
 * проекта - для admin-аккаунтов Redmine это обычное дело (создатель проекта
 * не добавляется в участники автоматически), но `POST /issues.json` при этом
 * прекрасно принимает `assigned_to_id` = id этого пользователя (проверено
 * напрямую через API). Т.е. "назначить на себя" валидно чаще, чем показывает
 * список участников - поэтому текущего пользователя всегда подмешиваем в
 * начало списка, если API его не вернул.
 */
export function useProjectMembers(
  client: RedmineClient | null,
  projectId: number | null,
  currentUser?: { id: number; firstname: string; lastname: string } | null,
) {
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
        const users: ProjectMember[] = data.memberships
          .filter((m) => m.user)
          .map((m) => ({ id: m.user!.id, name: m.user!.name }));

        if (currentUser && !users.some((u) => u.id === currentUser.id)) {
          users.unshift({
            id: currentUser.id,
            name: `${currentUser.firstname} ${currentUser.lastname} (я)`,
          });
        }

        setMembers(users);

        // Подтягиваем email для аватарок отдельно, best-effort (issue #44):
        // список участников не ждёт этого и не падает, если /users/{id}.json
        // отдаёт 403 (не-админам Redmine чужой mail не показывает).
        void Promise.all(
          users.map(async (u) => {
            try {
              const res = await client.GET("/users/{user_id}.{format}", {
                params: { path: { format: "json", user_id: u.id } },
              });
              const mail = res.data?.user?.mail;
              return mail ? { ...u, mail } : u;
            } catch {
              return u;
            }
          }),
        ).then((withMail) => {
          if (!cancelled && withMail.some((u) => u.mail)) setMembers(withMail);
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, currentUser]);

  return { members, isLoading };
}
