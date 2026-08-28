import { useCallback, useEffect, useState } from "react";
import {
  loadKanbanColumnPrefs,
  saveKanbanColumnPrefs,
} from "@/lib/kanban-columns-storage";
import {
  EMPTY_KANBAN_PREFS,
  type KanbanColumnPrefs,
} from "@/lib/kanban-columns";

/**
 * Настройка колонок канбана (какие показывать, порядок) с персистом в
 * localStorage. Ключ включает проект - перечитываем при смене
 * проекта/пользователя. `projectId <= 0` трактуется как "проект не выбран" -
 * персиста нет, отдаём дефолт.
 */
export function useKanbanColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
  projectId: number,
): [KanbanColumnPrefs, (next: KanbanColumnPrefs) => void] {
  const [prefs, setPrefs] = useState<KanbanColumnPrefs>(() =>
    projectId > 0
      ? loadKanbanColumnPrefs(baseUrl, userId, projectId)
      : EMPTY_KANBAN_PREFS,
  );

  // Перечитываем при смене проекта - но не сбрасываем на дефолт во время
  // переходного projectId <= 0 (проект в шапке ещё не подставился).
  useEffect(() => {
    if (projectId > 0) {
      setPrefs(loadKanbanColumnPrefs(baseUrl, userId, projectId));
    }
  }, [baseUrl, userId, projectId]);

  const update = useCallback(
    (next: KanbanColumnPrefs) => {
      setPrefs(next);
      if (projectId > 0) {
        saveKanbanColumnPrefs(baseUrl, userId, projectId, next);
      }
    },
    [baseUrl, userId, projectId],
  );

  return [prefs, update];
}
