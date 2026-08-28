import { useCallback, useEffect, useState } from "react";
import {
  loadListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns-storage";
import type { ListColumnPrefs } from "@/lib/list-columns";

/**
 * Настройка колонок списка задач (какие показывать, порядок) с персистом в
 * localStorage по baseUrl+user (issue #56).
 */
export function useListColumnPrefs(
  baseUrl: string | null,
  userId: number | undefined,
): [ListColumnPrefs, (next: ListColumnPrefs) => void] {
  const [prefs, setPrefs] = useState<ListColumnPrefs>(() =>
    loadListColumnPrefs(baseUrl, userId),
  );

  useEffect(() => {
    setPrefs(loadListColumnPrefs(baseUrl, userId));
  }, [baseUrl, userId]);

  const update = useCallback(
    (next: ListColumnPrefs) => {
      setPrefs(next);
      saveListColumnPrefs(baseUrl, userId, next);
    },
    [baseUrl, userId],
  );

  return [prefs, update];
}
