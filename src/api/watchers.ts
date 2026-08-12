import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type Watcher = components["schemas"]["id_name"];

/** Подписывает пользователя на задачу. Отвечает 204 даже если user_id не существует (см. спеку). */
export async function addWatcher(
  client: RedmineClient,
  issueId: number,
  userId: number,
): Promise<void> {
  const { error } = await client.POST("/issues/{issue_id}/watchers.{format}", {
    params: { path: { format: "json", issue_id: issueId } },
    body: { user_id: userId },
  });

  if (error) {
    throw new Error("Не удалось добавить наблюдателя.");
  }
}

/** Отписывает пользователя от задачи. */
export async function removeWatcher(
  client: RedmineClient,
  issueId: number,
  userId: number,
): Promise<void> {
  const { error } = await client.DELETE("/issues/{issue_id}/watchers/{user_id}.{format}", {
    params: { path: { format: "json", issue_id: issueId, user_id: userId } },
  });

  if (error) {
    throw new Error("Не удалось убрать наблюдателя.");
  }
}
